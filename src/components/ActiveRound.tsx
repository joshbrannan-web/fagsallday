import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Menu, DollarSign, FileText, Crown, Home, CheckSquare, Flag, Check, TrendingDown, Flame, WifiOff, Cloud, AlertTriangle, Grid3X3, Share2, Loader2, Trophy } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useWakeLock } from '@/hooks/useWakeLock';
import { offlineStorage } from '@/services/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { GameType, GameSettings, WolfHoleData, FBOPressState, SixesPressState } from '../types';
import { calculateAggregatedHolePnL, calculateBloodyBankerPnL, areHolesComplete, calculateBankerMatchupStrokes, calculateGameStrokes, calculateFBOHoleWinners, calculateFBOMatchupHoleWinner, getFBOHoleNetScores, getFBODormieStatus, getFBOPressEligibility, getFBOOverallDormieStatus, getFBOPressEligibilityOverall, getFBOMatchupDormieStatus, getFBOMatchupOverallDormieStatus, calculatePerGameTotals } from '../services/gameEngine';
import { validateHoleInput, interpretVoiceCommand } from '../services/aiAssistant';

import { Stockton6TeamSetup, Stockton6StatusBar, Stockton6DotsInput } from './stockton6';
import { isStretchStartHole, getTeamAssignment, getStretchForHole, calculateRelativeStrokes } from '../services/stockton6Engine';
import { SixesTeamSetup, SixesStatusBar, SixesStretchSummary } from './sixes';
import { isSixesStretchStartHole, getSixesTeamAssignment, getSixesStretchForHole, isSixesStretchEndHole, getSixesPresses, getSixesMode, getStretchStartHole, SixesMode } from '../services/sixesEngine';
import { TeamBankerTeamSetup } from './teamBanker';
import TournamentTabPanel from './tournament/TournamentTabPanel';
import { useTournamentOverlay } from '@/hooks/useTournamentOverlay';
import { isTeamBankerStretchStartHole, getTeamBankerTeamAssignment, getTeamBankerStretchForHole, getTeamBankerMode, getTeamBankerStretchStartHole as getTBStretchStartHole, getTeamBankerAllStretches } from '../services/teamBankerEngine';

const ActiveRound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRound, updateScore, updateGameData, updateGameDataBatch, roundTotals, isLoading, refetchRounds } = useApp();
  const isReadOnly = currentRound?.isShared === true;
  
  // Tournament mode state — fall back to persisted _TOURNAMENT_META when location.state is lost
  const tournamentState = (location.state as any) || {};
  const meta = (currentRound?.gameData as any)?.['_TOURNAMENT_META'];
  const tournamentGroupId = (tournamentState.tournamentGroupId || meta?.tournamentGroupId) as string | undefined;
  if (meta && !tournamentGroupId) {
    console.warn('[Tournament] Missing tournamentGroupId in _TOURNAMENT_META — scores will not be tracked in tournament leaderboard');
  }
  const tournamentPlayerMapping = (tournamentState.playerMapping || meta?.playerMapping) as Record<string, string> | undefined;
  const tournamentName = tournamentState.tournamentName || meta?.tournamentName;
  const tournamentRoundName = tournamentState.tournamentRoundName || meta?.roundName;
  const teamMatchup = tournamentState.teamMatchup || meta?.teamMatchup;
  const tournamentOverlay = useTournamentOverlay(
    tournamentGroupId,
    tournamentName,
    tournamentRoundName,
    tournamentPlayerMapping,
    teamMatchup,
  );

  // Initialize active hole from navigation state if available
  const [activeHole, setActiveHole] = useState(() => {
    const state = location.state as { startHole?: number } | null;
    return state?.startHole || 1;
  });
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Always start minimized - user can expand at any time
  const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(true);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showHolePicker, setShowHolePicker] = useState(false);
  const [declinedPresses, setDeclinedPresses] = useState<Set<string>>(new Set());
  const preferredTab = tournamentState.preferredTab as 'betting' | 'tournament' | undefined;
  const [activeTab, setActiveTab] = useState<'betting' | 'tournament'>(
    preferredTab || 'betting'
  );
  const [isGeneratingLinks, setIsGeneratingLinks] = useState(false);
  
  const isOnline = useOnlineStatus();
  const { isActive: wakeLockActive } = useWakeLock(true);
  const pendingSyncCount = offlineStorage.getPendingSyncCount();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const playerCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Refresh/close guard - warn user before leaving during active round
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Reset declined presses when hole changes
  useEffect(() => {
    setDeclinedPresses(new Set());
  }, [activeHole]);

  // All hooks must be called before any early returns!
  // State for Bloody Banker activation dialog
  const [showBloodyActivateDialog, setShowBloodyActivateDialog] = useState<string | null>(null); // gameId or null

  // Check if any regular Banker game needs the activation prompt at hole 16
  useEffect(() => {
    if (!currentRound || activeHole !== 16) return;
    
    const regularBankerGames = currentRound.games.filter(g => g.type === GameType.BANKER);
    for (const game of regularBankerGames) {
      const alreadyChosen = currentRound.gameData?.[game.id]?.[0]?.['_META_BLOODY_ACTIVATED'];
      if (alreadyChosen === undefined || alreadyChosen === null) {
        // Haven't made a choice yet — show dialog
        setShowBloodyActivateDialog(game.id);
        return;
      }
    }
  }, [currentRound, activeHole]);

  // Bloody Banker "Down the Most" logic for holes 16, 17, 18
  const bloodyBankerDownPlayer = useMemo(() => {
    if (!currentRound) return null;
    
    // Include both explicit Bloody Banker games AND regular Banker games with activation flag
    const bloodyBankerGames = currentRound.games.filter(g => 
      g.type === GameType.BLOODY_BANKER || 
      (g.type === GameType.BANKER && currentRound.gameData?.[g.id]?.[0]?.['_META_BLOODY_ACTIVATED'] === true)
    );
    if (bloodyBankerGames.length === 0) return null;
    
    // Check if current hole is 16, 17, or 18
    if (activeHole < 16 || activeHole > 18) return null;
    
    const previousHole = activeHole - 1; // 15, 16, or 17
    
    // Check if all previous holes are complete
    if (!areHolesComplete(currentRound, previousHole)) return null;
    
    // Calculate P&L for each Bloody Banker game
    const downPlayers: { game: GameSettings; playerId: string; amount: number }[] = [];
    
    bloodyBankerGames.forEach(game => {
      const pnl = calculateBloodyBankerPnL(currentRound, game, previousHole);
      
      // Find the player who is down the most (most negative)
      let lowestPlayerId: string | null = null;
      let lowestAmount = 0;
      
      currentRound.players.forEach(p => {
        const playerPnL = pnl[p.id] || 0;
        if (playerPnL < lowestAmount) {
          lowestAmount = playerPnL;
          lowestPlayerId = p.id;
        }
      });
      
      // Only show if someone is actually down money
      if (lowestPlayerId && lowestAmount < 0) {
        downPlayers.push({ game, playerId: lowestPlayerId, amount: lowestAmount });
      }
    });
    
    return downPlayers.length > 0 ? downPlayers : null;
  }, [currentRound, activeHole]);

  // Stockton 6's: Check if we need to show team setup (must be before early return!)
  const stockton6NeedsSetup = useMemo(() => {
    if (!currentRound) return false;
    const stockton6Games = currentRound.games.filter(g => g.type === GameType.STOCKTON_6);
    const stockton6Game = stockton6Games[0];
    if (!stockton6Game || !isStretchStartHole(activeHole)) return false;
    const stretch = getStretchForHole(activeHole);
    const teamAssignment = getTeamAssignment(currentRound.gameData, stockton6Game.id, stretch);
    return !teamAssignment;
  }, [currentRound, activeHole]);

  // 6's: Check if we need to show team setup (must be before early return!)
  const sixesNeedsSetup = useMemo(() => {
    if (!currentRound) return false;
    const sixesGames = currentRound.games.filter(g => g.type === GameType.SIXES);
    const sixesGame = sixesGames[0];
    if (!sixesGame) return false;
    const mode = getSixesMode(currentRound.gameData, sixesGame.id);
    if (!isSixesStretchStartHole(activeHole, mode)) return false;
    const stretch = getSixesStretchForHole(activeHole, mode);
    const teamAssignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch, mode);
    return !teamAssignment;
  }, [currentRound, activeHole]);

  // Team Banker: Check if we need to show team setup
  const teamBankerNeedsSetup = useMemo(() => {
    if (!currentRound) return false;
    const tbGame = currentRound.games.find(g => g.type === GameType.TEAM_BANKER);
    if (!tbGame) return false;
    const mode = currentRound.gameData?.[tbGame.id]?.[1]?._META_MODE ?? tbGame.config?.teamBanker?.mode ?? 'sixes';
    if (!isTeamBankerStretchStartHole(activeHole, mode)) return false;
    const stretch = getTeamBankerStretchForHole(activeHole, mode);
    const assignment = getTeamBankerTeamAssignment(currentRound.gameData, tbGame.id, stretch, mode);
    return !assignment;
  }, [currentRound, activeHole]);


  // Get which team a player is on for the current hole (6's, Stockton 6's, or Team Banker)
  const getPlayerTeamColor = (playerId: string): 'A' | 'B' | null => {
    if (!currentRound) return null;
    
    // Check Stockton 6's first
    const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);
    if (stockton6Game) {
      const stretch = getStretchForHole(activeHole);
      const teamAssignment = getTeamAssignment(currentRound.gameData, stockton6Game.id, stretch);
      if (teamAssignment) {
        if (teamAssignment.teamA.includes(playerId)) return 'A';
        if (teamAssignment.teamB.includes(playerId)) return 'B';
      }
    }
    
    // Then check 6's
    const sixesGame = currentRound.games.find(g => g.type === GameType.SIXES);
    if (sixesGame) {
      const mode = getSixesMode(currentRound.gameData, sixesGame.id);
      const stretch = getSixesStretchForHole(activeHole, mode);
      const teamAssignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch, mode);
      if (teamAssignment) {
        if (teamAssignment.teamA.includes(playerId)) return 'A';
        if (teamAssignment.teamB.includes(playerId)) return 'B';
      }
    }
    
    // Then check Team Banker
    const tbGame = currentRound.games.find(g => g.type === GameType.TEAM_BANKER);
    if (tbGame) {
      const mode = getTeamBankerMode(currentRound.gameData, tbGame.id);
      const stretch = getTeamBankerStretchForHole(activeHole, mode);
      const assignment = getTeamBankerTeamAssignment(currentRound.gameData, tbGame.id, stretch, mode);
      if (assignment) {
        if (assignment.teamA.includes(playerId)) return 'A';
        if (assignment.teamB.includes(playerId)) return 'B';
      }
    }
    
    return null;
  };

  useEffect(() => {
    if (!currentRound) {
      // Allow the component to render the empty state
    }
  }, [currentRound, navigate]);

  // Auto-select birdie dot when player scores exactly par - 1 on Stockton 6's
  useEffect(() => {
    if (!currentRound || isReadOnly) return;
    
    const stockton6Games = currentRound.games.filter(g => g.type === GameType.STOCKTON_6);
    const stockton6Game = stockton6Games[0];
    if (!stockton6Game) return;
    
    const courseHole = currentRound.course.holes.find(h => h.number === activeHole);
    if (!courseHole) return;
    
    const birdieScore = courseHole.par - 1;
    
    currentRound.players.forEach(player => {
      const playerScore = currentRound.scores[activeHole]?.[player.id];
      const currentPlayerDots = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots?.[player.id] || {};
      const hasBirdieDot = currentPlayerDots.birdie === true;
      
      if (playerScore === birdieScore && !hasBirdieDot) {
        // Player scored birdie, auto-add BIRDIE dot
        const existingDotsObj = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots || {};
        const updatedPlayerDots = { ...currentPlayerDots, birdie: true };
        const updatedDotsObj = { ...existingDotsObj, [player.id]: updatedPlayerDots };
        updateGameData(stockton6Game.id, activeHole, 'dots', updatedDotsObj);
      } else if (playerScore !== birdieScore && hasBirdieDot) {
        // Player no longer has birdie, remove BIRDIE dot
        const existingDotsObj = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots || {};
        const updatedPlayerDots = { ...currentPlayerDots, birdie: false };
        const updatedDotsObj = { ...existingDotsObj, [player.id]: updatedPlayerDots };
        updateGameData(stockton6Game.id, activeHole, 'dots', updatedDotsObj);
      }
    });
  }, [currentRound, activeHole, updateGameData]);

  // Auto-calculate FBO dots when scores change (based on lowest net score)
  useEffect(() => {
    if (!currentRound || isReadOnly) return;
    
    const fboGames = currentRound.games.filter(g => g.type === GameType.FBO);
    if (fboGames.length === 0) return;
    
    fboGames.forEach(game => {
      const isHeadToHead = game.config.fbo?.gameMode === 'headToHead';
      const matchups = game.config.fbo?.headToHeadMatchups || [];
      
      if (isHeadToHead && matchups.length > 0) {
        // HEAD-TO-HEAD MODE: Calculate dots per matchup independently
        // Each matchup uses only its two players for relative handicap calculation
        const matchupDots: { [matchupKey: string]: string | null } = {};
        
        matchups.forEach(matchup => {
          const winner = calculateFBOMatchupHoleWinner(
            currentRound,
            game,
            activeHole,
            matchup.player1Id,
            matchup.player2Id
          );
          const matchupKey = `${matchup.player1Id}_${matchup.player2Id}`;
          matchupDots[matchupKey] = winner;
        });
        
        // Store as matchupDots instead of dots
        const currentMatchupDots = currentRound.gameData?.[game.id]?.[activeHole]?.matchupDots || {};
        const isDifferent = JSON.stringify(matchupDots) !== JSON.stringify(currentMatchupDots);
        
        if (isDifferent) {
          updateGameData(game.id, activeHole, 'matchupDots', matchupDots);
        }
      } else {
        // ALL TOGETHER MODE: Existing global dots logic
        const winners = calculateFBOHoleWinners(currentRound, game, activeHole);
        const currentDots: string[] = currentRound.gameData?.[game.id]?.[activeHole]?.dots || [];
        
        // Only update if different (to avoid infinite loop)
        const winnersSet = new Set(winners);
        const currentSet = new Set(currentDots);
        const isDifferent = winners.length !== currentDots.length || 
                            winners.some(w => !currentSet.has(w)) ||
                            currentDots.some(d => !winnersSet.has(d));
        
        if (isDifferent && winners.length > 0) {
          updateGameData(game.id, activeHole, 'dots', winners);
        }
      }
    });
  }, [currentRound?.scores, activeHole, currentRound?.games, updateGameData]);

  // Auto-scroll to top when changing holes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeHole]);

  // Tournament mode: sync scores to tournament_hole_scores whenever scores change
  useEffect(() => {
    if (!tournamentGroupId || !tournamentPlayerMapping || !currentRound || isReadOnly) return;
    if (tournamentOverlay.isLoading) return; // Wait for overlay to be ready
    // Bulk-sync all holes, not just activeHole
    Object.entries(currentRound.scores).forEach(([holeStr, holeScores]) => {
      const holeNum = Number(holeStr);
      currentRound.players.forEach(player => {
        const score = holeScores[player.id];
        if (typeof score === 'number' && score > 0) {
          tournamentOverlay.syncScore(holeNum, player.id, score);
        }
      });
    });
  }, [currentRound?.scores, tournamentGroupId, tournamentPlayerMapping, tournamentOverlay.isLoading]);

  // Fallback: if navigated from tournament setup but round hasn't loaded yet, trigger refetch
  const [tournamentRefetchAttempted, setTournamentRefetchAttempted] = useState(false);
  useEffect(() => {
    if (!currentRound && !isLoading && tournamentGroupId && !tournamentRefetchAttempted) {
      setTournamentRefetchAttempted(true);
      refetchRounds();
    }
  }, [currentRound, isLoading, tournamentGroupId, tournamentRefetchAttempted, refetchRounds]);

  if (!currentRound) {
    if (isLoading || (tournamentGroupId && !tournamentRefetchAttempted)) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center space-y-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <h2 className="text-xl font-bold text-foreground">Loading Course...</h2>
          <p className="text-muted-foreground">Preparing your round</p>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center space-y-6">
        <h2 className="text-xl font-bold text-foreground">No Active Round</h2>
        <p className="text-muted-foreground">Please set up a new round to start scoring.</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2"
        >
          <Home className="w-5 h-5" /> Go Home
        </button>
      </div>
    );
  }

  const courseHole = currentRound.course.holes.find(h => h.number === activeHole);

  const canAdvanceHole = (): boolean => {
    return currentRound.players.every(p => {
      const score = currentRound.scores[activeHole]?.[p.id];
      return typeof score === 'number' && score > 0;
    });
  };

  const handleNextHole = () => {
    if (!isReadOnly && !canAdvanceHole()) {
      const missingPlayer = currentRound.players.find(p => {
        const score = currentRound.scores[activeHole]?.[p.id];
        return !(typeof score === 'number' && score > 0);
      });
      if (missingPlayer) {
        playerCardRefs.current[missingPlayer.id]?.scrollIntoView({ 
          behavior: 'smooth', block: 'center' 
        });
      }
      toast.error('Enter scores for all players before moving on');
      return;
    }
    if (activeHole === 18) {
      if (isReadOnly) return; // Read-only users can't finish
      navigate('/summary');
    } else {
      setActiveHole(h => h + 1);
    }
  };
  const openBetGames = currentRound.games.filter(g => g.type === GameType.OPEN_BETTING);
  const bankerGames = currentRound.games.filter(g => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER);
  const bloodyBankerGames = currentRound.games.filter(g => g.type === GameType.BLOODY_BANKER);
  const fboGames = currentRound.games.filter(g => g.type === GameType.FBO);
  const stockton6Games = currentRound.games.filter(g => g.type === GameType.STOCKTON_6);
  const stockton6Game = stockton6Games[0];
  const wolfGames = currentRound.games.filter(g => g.type === GameType.WOLF);
  const wolfGame = wolfGames[0];
  const ninePointsGames = currentRound.games.filter(g => g.type === GameType.NINE_POINTS);
  const ninePointsGame = ninePointsGames[0];
  const sixesGames = currentRound.games.filter(g => g.type === GameType.SIXES);
  const sixesGame = sixesGames[0];
  
  // Calculate per-hole P&L for all players
  const holePnL = calculateAggregatedHolePnL(currentRound);

  // Voice Input Logic
  const handleVoiceInput = () => {
    if (isReadOnly) return;
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice not supported in this browser. Try Chrome.");
      return;
    }
    setIsListening(true);
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const command = interpretVoiceCommand(transcript, currentRound.players, activeHole);
      if (command.action === 'SCORE' && command.playerId && command.score) {
        let finalScore = command.score;
        if (finalScore <= 0 && courseHole) {
          finalScore = courseHole.par + finalScore; 
        }
        updateScore(activeHole, command.playerId, finalScore);
        setFeedback(`Recorded: ${transcript} -> ${finalScore}`);
      } else {
        setFeedback(`Couldn't parse: "${transcript}"`);
      }
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleScoreChange = (pid: string, delta: number) => {
    if (isReadOnly) return;
    const current = currentRound.scores[activeHole]?.[pid] || courseHole!.par;
    const newScore = Math.max(1, current + delta);
    const player = currentRound.players.find(p => p.id === pid)!;
    const validation = validateHoleInput(newScore, courseHole!.par, player);
    if (validation.severity === 'warning') {
      console.warn(validation.message);
    }
    updateScore(activeHole, pid, newScore);
  };

  const handleScoreClick = (pid: string, displayScore: number) => {
    if (isReadOnly) return;
    const player = currentRound.players.find(p => p.id === pid)!;
    const validation = validateHoleInput(displayScore, courseHole!.par, player);
    if (validation.severity === 'warning') {
      console.warn(validation.message);
    }
    updateScore(activeHole, pid, displayScore);
  };

  const handleStrokeToggle = (pid: string, autoStrokes: number) => {
    if (isReadOnly) return;
    const manualStrokes = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[pid];
    
    if (manualStrokes !== undefined && manualStrokes !== null) {
      const newValue = manualStrokes > 0 ? 0 : 1;
      updateGameData('MANUAL_STROKES', activeHole, pid, newValue);
    } else {
      const newValue = autoStrokes > 0 ? 0 : 1;
      updateGameData('MANUAL_STROKES', activeHole, pid, newValue);
    }
  };

  const handleOpenBetChange = (gameId: string, pid: string, delta: number) => {
    if (isReadOnly) return;
    const current = currentRound.gameData?.[gameId]?.[activeHole]?.[pid] || 0;
    updateGameData(gameId, activeHole, pid, current + delta);
  };

  const handleBankerSelect = (gameId: string, bankerId: string) => {
    if (isReadOnly) return;
    updateGameData(gameId, activeHole, '_META_BANKER_ID', bankerId);
  };

  const handleBankerMultiplier = (gameId: string, pid: string, mult: number) => {
    if (isReadOnly) return;
    updateGameData(gameId, activeHole, pid, mult);
  };

  const handleBankerPressAll = (gameId: string, currentMult: number) => {
    if (isReadOnly) return;
    updateGameData(gameId, activeHole, '_META_BANKER_MULT', currentMult);
  };

  // handleFboDotToggle removed - FBO dots are now auto-calculated based on net scores

  const handleShareRoundLink = async () => {
    if (!currentRound) return;
    setIsGeneratingLinks(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-round-links', {
        body: { round_id: currentRound.id }
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to generate links');
        return;
      }
      const shareText = data.shareText as string;
      if (navigator.share) {
        await navigator.share({ title: 'Round Link', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success('Round links copied to clipboard!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Failed to share round links');
      }
    } finally {
      setIsGeneratingLinks(false);
    }
  };

  // FBO Press handler (supports double/triple press and overall segment, and H2H mode with opponentId)
  const handleFBOPress = (gameId: string, playerId: string, segment: 'front' | 'back' | 'overall', pressLevel: number = 1, opponentId?: string) => {
    if (isReadOnly) return;
    const fboGame = currentRound.games.find(g => g.id === gameId);
    if (!fboGame) return;
    
    // For H2H mode, use the matchup's unit value if available
    let unitValue = fboGame.unitStake;
    if (opponentId && fboGame.config.fbo?.headToHeadMatchups) {
      const matchup = fboGame.config.fbo.headToHeadMatchups.find(m => 
        (m.player1Id === playerId && m.player2Id === opponentId) ||
        (m.player2Id === playerId && m.player1Id === opponentId)
      );
      if (matchup) {
        unitValue = matchup.unitValue;
      }
    }
    
    const newPress: FBOPressState = {
      playerId: String(playerId), // Ensure playerId is stored as string
      segment,
      startHole: activeHole,
      unitValue,
      settled: false,
      pressLevel,
      opponentId: opponentId ? String(opponentId) : undefined
    };
    
    // Fix: Read from hole 1 where presses are stored
    const fboGameData = currentRound.gameData?.[gameId] || {};
    const existingPresses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
    
    // Store presses at hole 1 to keep them at the game level
    updateGameData(gameId, 1 as any, '_META_PRESSES' as any, [...existingPresses, newPress]);
    
    const player = currentRound.players.find(p => p.id === playerId);
    const opponent = opponentId ? currentRound.players.find(p => p.id === opponentId) : null;
    const pressLabel = pressLevel === 1 ? 'pressed' : 
                       pressLevel === 2 ? 'double pressed' : 
                       `${pressLevel}x pressed`;
    
    const segmentLabel = segment === 'front' ? 'Front 9' : 
                         segment === 'back' ? 'Back 9' : 
                         'Overall';
    
    const vsLabel = opponent ? ` vs ${opponent.name}` : '';
    
    import('sonner').then(({ toast }) => {
      toast.success(`${player?.name} ${pressLabel} the ${segmentLabel}${vsLabel}!`);
    });
  };

  // Handler to remove/undo an FBO press
  const handleFBOUnpress = (
    gameId: string, 
    playerId: string, 
    segment: 'front' | 'back' | 'overall', 
    opponentId?: string
  ) => {
    if (isReadOnly) return;
    const fboGameData = currentRound.gameData?.[gameId] || {};
    const existingPresses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
    
    // Filter out the press to remove
    const updatedPresses = existingPresses.filter(p => {
      const matchesPlayer = String(p.playerId) === String(playerId);
      const matchesSegment = p.segment === segment;
      const matchesOpponent = opponentId 
        ? String(p.opponentId) === String(opponentId)
        : !p.opponentId;
      return !(matchesPlayer && matchesSegment && matchesOpponent);
    });
    
    updateGameData(gameId, 1 as any, '_META_PRESSES' as any, updatedPresses);
    
    const player = currentRound.players.find(p => p.id === playerId);
    const segmentLabel = segment === 'front' ? 'Front 9' : 
                         segment === 'back' ? 'Back 9' : 
                         'Overall';
    
    import('sonner').then(({ toast }) => {
      toast.info(`${player?.name} cancelled ${segmentLabel} press`);
    });
  };

  // Helper to check if H2H press exists
  const getH2HPressExists = (gameId: string, playerId: string, opponentId: string, segment: 'front' | 'back' | 'overall'): boolean => {
    const fboGameData = currentRound.gameData?.[gameId] || {};
    const presses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
    return presses.some(p => 
      String(p.playerId) === String(playerId) &&
      String(p.opponentId) === String(opponentId) &&
      p.segment === segment
    );
  };

  // Helper to check if pool press exists
  const getPoolPressExists = (gameId: string, playerId: string, segment: 'front' | 'back' | 'overall'): boolean => {
    const fboGameData = currentRound.gameData?.[gameId] || {};
    const presses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
    return presses.some(p => 
      String(p.playerId) === String(playerId) &&
      p.segment === segment &&
      !p.opponentId
    );
  };

  // 6's Press handler
  const handleSixesPress = (gameId: string, teamDormie: 'A' | 'B') => {
    if (isReadOnly) return;
    if (!sixesGame) return;
    
    // Get mode from Stretch 1 metadata (where it's always stored)
    const mode = getSixesMode(currentRound.gameData, gameId);
    const stretch = getSixesStretchForHole(activeHole, mode);
    const stretchStartHole = getStretchStartHole(stretch, mode);
    const sixesData = currentRound.gameData?.[gameId]?.[stretchStartHole] || {};
    const existingPresses: SixesPressState[] = sixesData._META_PRESSES || [];
    const unitValue = sixesData._META_UNIT_VALUE || sixesGame.unitStake;
    
    const newPress: SixesPressState = {
      triggeredBy: '', // Could track which player clicked
      teamDormie,
      stretch,
      startHole: activeHole,
      unitValue,
      settled: false
    };
    
    updateGameData(gameId, stretchStartHole, '_META_PRESSES', [...existingPresses, newPress]);
    
    import('sonner').then(({ toast }) => {
      toast.success(`Team ${teamDormie} pressed! $${unitValue} side bet active.`);
    });
  };

  const getFboDotsForPlayer = (gameId: string, playerId: string): number => {
    const fboData = currentRound.gameData?.[gameId] || {};
    let total = 0;
    for (let h = 1; h <= currentRound.course.holes.length; h++) {
      const holeDots: (string | number)[] = fboData[h]?.dots || [];
      // Normalize to strings for comparison
      if (holeDots.map(id => String(id)).includes(String(playerId))) total++;
    }
    return total;
  };

  const getPlayerTotalGross = (pid: string) => {
    let total = 0;
    Object.values(currentRound.scores).forEach(holeScores => {
      const s = holeScores[pid];
      if (typeof s === 'number') total += s;
    });
    return total;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Home Confirmation Dialog */}
      <AlertDialog open={showHomeConfirm} onOpenChange={setShowHomeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Round?</AlertDialogTitle>
            <AlertDialogDescription>
              Your round will be saved. You can return anytime to continue scoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/')}>Go Home</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-brand-gold/15 border-b border-brand-gold/30 px-4 py-2 text-center">
          <span className="text-xs font-bold text-brand-gold uppercase tracking-wider">
            👁 Viewing Round — Read Only
          </span>
        </div>
      )}

      {/* Top Bar: Hole Nav */}
      <div className="bg-brand-dark text-primary-foreground p-4 pb-2 shadow-lg sticky top-0 z-20">
        <div className="flex items-center justify-center mb-3 relative">
          <div className="absolute left-0 flex items-center gap-1">
            <button className="p-2" onClick={() => setShowHomeConfirm(true)}><Home className="w-5 h-5" /></button>
            <button className="p-2" onClick={() => navigate('/summary')}><Menu className="w-5 h-5" /></button>
          </div>
          <div className="absolute right-0 flex items-center gap-1">
            {!isReadOnly && currentRound.players.length >= 2 && (
              <button
                className="p-2"
                onClick={handleShareRoundLink}
                disabled={isGeneratingLinks}
              >
                {isGeneratingLinks ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
          <Popover open={showHolePicker} onOpenChange={setShowHolePicker}>
            <PopoverTrigger asChild>
              <button className="flex flex-col items-center text-center cursor-pointer hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold flex items-center gap-1">Hole {activeHole} <Grid3X3 className="w-4 h-4 opacity-50" /></h1>
                <div className="flex gap-3 text-xs text-muted-foreground font-mono tracking-wider">
                  <span>PAR {courseHole?.par}</span>
                  <span className="opacity-50">|</span>
                  <span>{courseHole?.yardage} YDS</span>
                  <span className="opacity-50">|</span>
                  <span>IDX {courseHole?.handicapIndex}</span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="bottom">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Jump to Hole</p>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
                  const isScored = currentRound.players.every(p => {
                    const s = currentRound.scores[hole]?.[p.id];
                    return typeof s === 'number' && s > 0;
                  });
                  const isCurrent = hole === activeHole;
                  return (
                    <button
                      key={hole}
                      onClick={() => { setActiveHole(hole); setShowHolePicker(false); }}
                      className={`w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition-colors ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : isScored
                            ? 'bg-success/20 text-success'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {isScored && !isCurrent ? <Check className="w-3.5 h-3.5" /> : hole}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          {/* Offline/Sync/WakeLock Status Indicators */}
          <div className="absolute right-0 flex items-center gap-1.5">
            {wakeLockActive && (
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Screen staying on" />
            )}
            {!isOnline ? (
              <div className="bg-destructive/20 text-destructive px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            ) : pendingSyncCount > 0 ? (
              <div className="bg-primary/20 text-primary px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <Cloud className="w-3 h-3 animate-pulse" />
                Syncing...
              </div>
            ) : null}
          </div>
        </div>

        {/* Hole completion dots */}
        <div className="flex justify-center gap-1 mb-3">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
            const isScored = currentRound.players.every(p => {
              const s = currentRound.scores[hole]?.[p.id];
              return typeof s === 'number' && s > 0;
            });
            const isCurrent = hole === activeHole;
            return (
              <button
                key={hole}
                onClick={() => setActiveHole(hole)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-primary scale-150'
                    : isScored
                      ? 'bg-success'
                      : 'bg-muted-foreground/30'
                }`}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center gap-4">
          <button 
            disabled={activeHole === 1}
            onClick={() => setActiveHole(h => h - 1)}
            className="bg-primary p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 flex justify-center">
            <button 
              onClick={() => navigate('/scorecard')}
              className="bg-primary-foreground/10 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-primary-foreground/20 transition-colors"
            >
              <FileText className="w-4 h-4" /> Scorecard
            </button>
          </div>
          {activeHole === 18 ? (
            isReadOnly ? (
              <button 
                disabled
                className="bg-muted p-3 rounded-xl opacity-30"
              >
                <Flag className="w-6 h-6 text-muted-foreground" />
              </button>
            ) : (
              <button 
                onClick={handleNextHole}
                className="bg-brand-gold p-3 rounded-xl shadow-lg animate-pulse"
              >
                <Flag className="w-6 h-6 text-brand-dark" />
              </button>
            )
          ) : (
            <button 
              onClick={handleNextHole}
              className="bg-primary p-3 rounded-xl disabled:opacity-30"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(() => {
          const scored = Object.keys(currentRound.scores).filter(h => {
            const hs = currentRound.scores[Number(h)];
            return currentRound.players.every(p => typeof hs?.[p.id] === 'number' && hs[p.id] > 0);
          }).length;
          return <Progress value={(scored / 18) * 100} className="h-1 mt-2 bg-muted-foreground/20" />;
        })()}
      </div>

      {/* Stockton 6's Team Setup - Show at stretch starts if teams not set */}
      {!isReadOnly && stockton6Game && stockton6NeedsSetup && (() => {
        const stretch = getStretchForHole(activeHole) as 1 | 2 | 3;
        
        // Gather previous stretch teams for auto-rotation
        const previousStretchTeams: { teamA: string[]; teamB: string[] }[] = [];
        if (stretch >= 2) {
          const stretch1Teams = getTeamAssignment(currentRound.gameData, stockton6Game.id, 1);
          if (stretch1Teams) {
            previousStretchTeams.push({ teamA: stretch1Teams.teamA, teamB: stretch1Teams.teamB });
          }
        }
        if (stretch >= 3) {
          const stretch2Teams = getTeamAssignment(currentRound.gameData, stockton6Game.id, 2);
          if (stretch2Teams) {
            previousStretchTeams.push({ teamA: stretch2Teams.teamA, teamB: stretch2Teams.teamB });
          }
        }
        
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <Stockton6TeamSetup
              players={currentRound.players}
              stretch={stretch}
              existingUnitValue={stockton6Game.unitStake}
              existingDotValue={stockton6Game.config?.stockton6?.dotValue || 2}
              previousStretchTeams={previousStretchTeams}
              onConfirm={(teamA, teamB, unitValue, dotValue) => {
                const stretchStartHole = stretch === 1 ? 1 : stretch === 2 ? 7 : 13;
                updateGameDataBatch(stockton6Game.id, stretchStartHole, {
                  _META_TEAM_A: teamA,
                  _META_TEAM_B: teamB,
                  _META_UNIT_VALUE: unitValue,
                  _META_DOT_VALUE: dotValue,
                  _META_LOCKED: true
                });
              }}
              onCancel={() => navigate('/summary')}
            />
          </div>
        );
      })()}

      {/* 6's Team Setup - Show at stretch starts if teams not set */}
      {!isReadOnly && sixesGame && sixesNeedsSetup && (() => {
        const mode = getSixesMode(currentRound.gameData, sixesGame.id);
        const stretch = getSixesStretchForHole(activeHole, mode);
        
        // Get Stretch 1 settings to carry forward to subsequent stretches
        const stretch1Settings = stretch > 1 
          ? getSixesTeamAssignment(currentRound.gameData, sixesGame.id, 1, mode)
          : null;
        
        // Gather previous stretch teams for auto-rotation
        const previousStretchTeams: { teamA: string[]; teamB: string[] }[] = [];
        const totalStretches = mode === 'threes' ? 6 : 3;
        for (let s = 1; s < stretch; s++) {
          const prevTeams = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, s as 1|2|3|4|5|6, mode);
          if (prevTeams) {
            previousStretchTeams.push({ teamA: prevTeams.teamA, teamB: prevTeams.teamB });
          }
        }
        
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <SixesTeamSetup
              players={currentRound.players}
              stretch={stretch}
              mode={mode}
              existingUnitValue={stretch1Settings?.unitValue ?? sixesGame.unitStake}
              existingUseHandicaps={stretch1Settings?.useHandicaps ?? sixesGame.config?.useHandicaps ?? true}
              existingUseSecondBall={stretch1Settings?.useSecondBallTiebreaker ?? sixesGame.config?.sixes?.useSecondBallTiebreaker ?? false}
              existingAllowPresses={stretch1Settings?.allowPresses ?? sixesGame.config?.sixes?.allowPresses ?? false}
              previousStretchTeams={previousStretchTeams}
              onConfirm={(teamA, teamB, unitValue, useHandicaps, useSecondBall, allowPresses) => {
                const stretchStartHole = getStretchStartHole(stretch, mode);
                updateGameDataBatch(sixesGame.id, stretchStartHole, {
                  _META_TEAM_A: teamA,
                  _META_TEAM_B: teamB,
                  _META_UNIT_VALUE: unitValue,
                  _META_USE_HANDICAPS: useHandicaps,
                  _META_USE_SECOND_BALL: useSecondBall,
                  _META_ALLOW_PRESSES: allowPresses,
                  _META_HANDICAP_MODE: stretch1Settings?.handicapMode ?? sixesGame.config?.handicapMode ?? 'absolute',
                  _META_MODE: stretch1Settings?.mode ?? mode,
                  _META_LOCKED: true
                });
              }}
              onCancel={() => navigate('/summary')}
            />
          </div>
        );
      })()}

      {/* Team Banker Team Setup - Show at stretch starts if teams not set */}
      {(() => {
        const tbGame = currentRound.games.find(g => g.type === GameType.TEAM_BANKER);
        if (isReadOnly || !tbGame || !teamBankerNeedsSetup) return null;
        
        const metaMode = currentRound.gameData?.[tbGame.id]?.[1]?._META_MODE;
        const mode = metaMode ?? tbGame.config?.teamBanker?.mode ?? 'sixes';
        const stretch = getTeamBankerStretchForHole(activeHole, mode);
        
        // Get Stretch 1 settings to carry forward (use normalized reader to fix legacy swapped metadata)
        const stretch1Assign = stretch > 1 ? getTeamBankerTeamAssignment(currentRound.gameData, tbGame.id, 1, mode) : null;
        const stretch1Settings = stretch1Assign ? {
          unitValue: stretch1Assign.unitValue,
          useHandicaps: stretch1Assign.useHandicaps,
          handicapMode: stretch1Assign.handicapMode,
          useSecondBallTiebreaker: stretch1Assign.useSecondBallTiebreaker,
          birdieMultiplier: stretch1Assign.birdieMultiplier,
          eagleMultiplier: stretch1Assign.eagleMultiplier,
          mode: stretch1Assign.mode,
        } : null;
        
        // Gather previous stretch teams for auto-rotation
        const previousStretchTeams: { teamA: string[]; teamB: string[] }[] = [];
        for (let s = 1; s < stretch; s++) {
          const prevAssignment = getTeamBankerTeamAssignment(currentRound.gameData, tbGame.id, s as any, mode);
          if (prevAssignment) {
            previousStretchTeams.push({ teamA: prevAssignment.teamA, teamB: prevAssignment.teamB });
          }
        }
        
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <TeamBankerTeamSetup
              players={currentRound.players}
              stretch={stretch}
              mode={mode}
              existingUnitValue={stretch1Settings?.unitValue ?? tbGame.unitStake}
              existingUseHandicaps={stretch1Settings?.useHandicaps ?? tbGame.config.useHandicaps ?? true}
              existingHandicapMode={stretch1Settings?.handicapMode ?? tbGame.config.handicapMode ?? 'relative'}
              existingUseSecondBall={stretch1Settings?.useSecondBallTiebreaker ?? tbGame.config.teamBanker?.useSecondBallTiebreaker ?? false}
              existingBirdieMultiplier={stretch1Settings?.birdieMultiplier ?? tbGame.config.birdieMultiplier ?? 3}
              existingEagleMultiplier={stretch1Settings?.eagleMultiplier ?? tbGame.config.eagleMultiplier ?? 5}
              previousStretchTeams={previousStretchTeams}
              onConfirm={(teamA, teamB, unitValue, useHandicaps, useSecondBall, handicapMode, birdieMultiplier, eagleMultiplier) => {
                const stretchStartHole = getTBStretchStartHole(stretch, mode);
                updateGameDataBatch(tbGame.id, stretchStartHole, {
                  _META_TEAM_A: teamA,
                  _META_TEAM_B: teamB,
                  _META_UNIT_VALUE: unitValue,
                  _META_USE_HANDICAPS: useHandicaps,
                  _META_HANDICAP_MODE: handicapMode,
                  _META_USE_SECOND_BALL: useSecondBall,
                  _META_BIRDIE_MULT: birdieMultiplier,
                  _META_EAGLE_MULT: eagleMultiplier,
                  _META_MODE: mode,
                  _META_LOCKED: true
                });
              }}
              onCancel={() => navigate('/summary')}
            />
          </div>
        );
      })()}

      {/* Tournament Toggle Tabs */}
      {!stockton6NeedsSetup && !sixesNeedsSetup && !teamBankerNeedsSetup && tournamentGroupId && (
        <div className="sticky top-0 z-20 bg-background px-4 pt-2 pb-1">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab('betting')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'betting'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              💰 Betting
            </button>
            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'tournament'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trophy className="w-4 h-4" style={activeTab !== 'tournament' ? { color: 'hsl(var(--brand-gold))' } : undefined} />
              Tournament
            </button>
          </div>
        </div>
      )}

      {/* Main Scoring Area - Hidden when team setup is needed */}
      {!stockton6NeedsSetup && !sixesNeedsSetup && !teamBankerNeedsSetup && activeTab === 'betting' && (
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto p-4 space-y-4 ${
          isBottomBarMinimized ? 'pb-16' : 'pb-48'
        }`}
      >
        {/* Stockton 6's Status Bar */}
        {stockton6Game && (
          <Stockton6StatusBar
            round={currentRound}
            game={stockton6Game}
            currentHole={activeHole}
          />
        )}

        {/* 6's Status Bar */}
        {sixesGame && (
          <SixesStatusBar
            round={currentRound}
            game={sixesGame}
            activeHole={activeHole}
            onTriggerPress={isReadOnly ? undefined : (teamDormie) => handleSixesPress(sixesGame.id, teamDormie)}
          />
        )}

        {/* Banker Game: Selection Header */}
        {bankerGames.map(game => {
          const holeData = currentRound.gameData?.[game.id]?.[activeHole] || {};
          const bankerId = holeData['_META_BANKER_ID'];
          const bankerMult = holeData['_META_BANKER_MULT'] || 1;

          return (
            <div key={game.id} className="bg-card rounded-2xl shadow-sm border border-brand-gold/50 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="bg-brand-gold text-brand-dark p-1 rounded">🏦</span> Select Banker
                </h3>
                {bankerId && (
                  <div className="text-xs font-bold text-brand-gold uppercase tracking-wide">
                    Stakes: {bankerMult > 1 ? `${bankerMult}x` : 'Standard'}
                  </div>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {currentRound.players.map(p => {
                  const playerHolePnL = holePnL[activeHole]?.[p.id] || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleBankerSelect(game.id, p.id)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${bankerId === p.id ? 'bg-brand-gold text-brand-dark border-brand-gold shadow-md scale-105' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${bankerId === p.id ? 'bg-brand-dark' : 'bg-muted-foreground/50'}`}></div>
                        <span className="font-bold text-sm">{p.name}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold ${playerHolePnL > 0 ? 'text-success' : playerHolePnL < 0 ? 'text-destructive' : bankerId === p.id ? 'text-brand-dark/50' : 'text-muted-foreground/50'}`}>
                        {playerHolePnL !== 0 ? (playerHolePnL > 0 ? `+$${playerHolePnL}` : `-$${Math.abs(playerHolePnL)}`) : '$0'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {bankerId && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Banker Power</span>
                  </div>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(mult => {
                      const isActive = bankerMult === mult;
                      const label = mult === 2 ? 'Double' : (mult === 3 ? 'Triple' : 'PreQuad');
                      return (
                        <button
                          key={mult}
                          onClick={() => handleBankerPressAll(game.id, isActive ? 1 : mult)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${isActive ? 'bg-brand-dark text-primary-foreground border-brand-dark shadow-md' : 'bg-muted text-muted-foreground border-border hover:border-primary hover:bg-muted/80'}`}
                        >
                          {label} All
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bloody Banker: Down the Most Player Gets to Set the Bet */}
        {bloodyBankerDownPlayer && bloodyBankerDownPlayer.map(({ game, playerId, amount }) => {
          const downPlayer = currentRound.players.find(p => p.id === playerId);
          const holeData = currentRound.gameData?.[game.id]?.[activeHole] || {};
          const bankerMult = holeData['_META_BANKER_MULT'] || 1;
          
          if (!downPlayer) return null;
          
          return (
            <div key={`bloody-down-${game.id}`} className="bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-2xl shadow-sm border-2 border-destructive/50 p-4 mb-4 animate-pulse-subtle">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-destructive text-destructive-foreground p-1.5 rounded-lg">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">🩸 Bloody Banker - Hole {activeHole}</h3>
                    <p className="text-xs text-muted-foreground">Down player sets the stakes!</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-destructive" />
                </div>
              </div>
              
              <div className="bg-card rounded-xl p-3 mb-3 border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center">
                      <span className="font-bold text-destructive">{downPlayer.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{downPlayer.name}</div>
                      <div className="text-xs text-destructive font-mono font-bold">
                        Down ${Math.abs(amount)} after {activeHole - 1} holes
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase font-bold">Gets to set</div>
                    <div className="text-lg font-bold text-brand-gold">{bankerMult}x</div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  {downPlayer.name}'s Power Pick
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(mult => {
                    const isActive = bankerMult === mult;
                    const label = mult === 1 ? 'Standard' : (mult === 2 ? 'Double' : (mult === 3 ? 'Triple' : 'PreQuad'));
                    return (
                      <button
                        key={mult}
                        onClick={() => handleBankerPressAll(game.id, mult)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${
                          isActive 
                            ? 'bg-destructive text-destructive-foreground border-destructive shadow-lg scale-105' 
                            : 'bg-card text-muted-foreground border-border hover:border-destructive/50 hover:bg-destructive/5'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Player Stake Adjustments - stores actual stake, not delta */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Adjust Player Stakes vs Banker (Base Bet)
                </div>
                <div className="space-y-2">
                  {currentRound.players.filter(p => p.id !== holeData['_META_BANKER_ID']).map(player => {
                    const stakeKey = `_STAKE_${player.id}`;
                    const defaultStake = game.unitStake * bankerMult;
                    // If no custom stake is set, use the default
                    const currentStake = holeData[stakeKey] !== undefined ? holeData[stakeKey] : defaultStake;
                    const isCustom = currentStake !== defaultStake;
                    
                    const handleStakeChange = (delta: number) => {
                      const newStake = Math.max(1, currentStake + delta);
                      updateGameData(game.id, activeHole, stakeKey, newStake);
                    };
                    
                    return (
                      <div key={player.id} className="flex items-center justify-between bg-card rounded-lg p-2 border border-border">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{player.name}</span>
                          <span className="text-xs text-muted-foreground">Base Bet</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStakeChange(-5)}
                            className="w-7 h-7 rounded bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive font-bold text-xs transition-colors"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleStakeChange(-1)}
                            className="w-7 h-7 rounded bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive font-bold text-xs transition-colors"
                          >
                            -1
                          </button>
                          <div className={`min-w-[60px] text-center px-2 py-1 rounded font-bold text-sm ${
                            isCustom ? 'bg-primary/20 text-primary' : 'bg-muted text-foreground'
                          }`}>
                            ${currentStake}
                          </div>
                          <button
                            onClick={() => handleStakeChange(1)}
                            className="w-7 h-7 rounded bg-muted hover:bg-success/20 text-muted-foreground hover:text-success font-bold text-xs transition-colors"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleStakeChange(5)}
                            className="w-7 h-7 rounded bg-muted hover:bg-success/20 text-muted-foreground hover:text-success font-bold text-xs transition-colors"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  Default: ${game.unitStake} × {bankerMult}x = ${game.unitStake * bankerMult}
                </div>
              </div>
            </div>
          );
        })}

        {/* Wolf Game UI */}
        {wolfGame && (() => {
          const wolfData = currentRound.gameData?.[wolfGame.id]?.[activeHole] as WolfHoleData | undefined;
          const wolfIndex = (activeHole - 1) % currentRound.players.length;
          const currentWolf = currentRound.players[wolfIndex];
          const opponents = currentRound.players.filter((_, i) => i !== wolfIndex);
          const hasAnyScores = currentRound.players.some(p => currentRound.scores[activeHole]?.[p.id] !== undefined);
          const isConfirmed = wolfData?.confirmed;
          
          // Wolf selection handlers
          const handleBlindLoneWolf = () => {
            updateGameData(wolfGame.id, activeHole, '_WOLF_DATA', {
              wolfId: currentWolf.id,
              partnerId: undefined,
              isLoneWolf: true,
              isBlindLoneWolf: true,
              confirmed: true
            } as WolfHoleData);
          };
          
          const handleSelectPartner = (partnerId: string) => {
            updateGameData(wolfGame.id, activeHole, '_WOLF_DATA', {
              wolfId: currentWolf.id,
              partnerId,
              isLoneWolf: false,
              isBlindLoneWolf: false,
              confirmed: true
            } as WolfHoleData);
          };
          
          const handleLoneWolf = () => {
            updateGameData(wolfGame.id, activeHole, '_WOLF_DATA', {
              wolfId: currentWolf.id,
              partnerId: undefined,
              isLoneWolf: true,
              isBlindLoneWolf: false,
              confirmed: true
            } as WolfHoleData);
          };
          
          // Sync wolf data to proper format (read from _WOLF_DATA)
          const actualWolfData = (currentRound.gameData?.[wolfGame.id]?.[activeHole]?.['_WOLF_DATA'] || wolfData) as WolfHoleData | undefined;
          const isActuallyConfirmed = actualWolfData?.confirmed;
          
          return (
            <div className={`rounded-2xl shadow-sm border p-4 mb-4 ${isActuallyConfirmed ? 'bg-card border-border' : 'bg-amber-500/5 border-amber-500/50'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-600 p-1.5 rounded text-lg">🐺</span>
                  <div>
                    <span>Wolf: {currentWolf.name}</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">Hole {activeHole}</span>
                  </div>
                </h3>
                {isActuallyConfirmed && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    actualWolfData?.isBlindLoneWolf ? 'bg-amber-500 text-amber-950' :
                    actualWolfData?.isLoneWolf ? 'bg-destructive/20 text-destructive' :
                    'bg-success/20 text-success'
                  }`}>
                    {actualWolfData?.isBlindLoneWolf ? '2x BLIND WOLF' :
                     actualWolfData?.isLoneWolf ? 'LONE WOLF' :
                     `+ ${currentRound.players.find(p => p.id === actualWolfData?.partnerId)?.name}`}
                  </span>
                )}
              </div>
              
              {/* All Wolf options visible at once - once selected, they disappear */}
              {!isActuallyConfirmed && (
                <div className="space-y-4">
                  {/* Blind Lone Wolf - Premium option at top */}
                  <button 
                    onClick={handleBlindLoneWolf}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    🎲 Blind Lone Wolf! (2x Points)
                  </button>
                  
                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-xs text-muted-foreground">or pick a partner</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  
                  {/* Partner Selection */}
                  <div className="grid grid-cols-3 gap-2">
                    {opponents.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => handleSelectPartner(p.id)}
                        className="py-2.5 rounded-lg bg-muted hover:bg-primary/20 text-foreground font-medium text-sm transition-colors border border-border hover:border-primary"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* Lone Wolf */}
                  <button 
                    onClick={handleLoneWolf}
                    className="w-full py-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-sm transition-colors border border-destructive/30"
                  >
                    Lone Wolf (1v3)
                  </button>
                </div>
              )}
              
              {/* Phase 3: Confirmed - show teams */}
              {isActuallyConfirmed && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Wolf Team:</span>
                    <span className="font-medium text-foreground">
                      {currentWolf.name}
                      {actualWolfData?.partnerId && ` + ${currentRound.players.find(p => p.id === actualWolfData.partnerId)?.name}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-medium text-foreground">
                      {opponents.filter(p => p.id !== actualWolfData?.partnerId).map(p => p.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Nine Points UI */}
        {ninePointsGame && (() => {
          // Calculate current point distribution based on net scores
          const netScores = currentRound.players.map(p => {
            const gross = currentRound.scores[activeHole]?.[p.id];
            if (typeof gross !== 'number') return { playerId: p.id, name: p.name, net: null };
            const strokes = calculateGameStrokes(currentRound, ninePointsGame, activeHole, p.id);
            return { playerId: p.id, name: p.name, net: gross - strokes };
          });
          
          const allScored = netScores.every(s => s.net !== null);
          
          // Calculate point distribution
          let points: { [id: string]: number } = {};
          if (allScored) {
            const sorted = [...netScores].sort((a, b) => (a.net ?? 99) - (b.net ?? 99));
            const [first, second, third] = sorted;
            
            if (first.net === second.net && second.net === third.net) {
              points = { [first.playerId]: 3, [second.playerId]: 3, [third.playerId]: 3 };
            } else if (first.net === second.net) {
              points = { [first.playerId]: 4, [second.playerId]: 4, [third.playerId]: 1 };
            } else if (second.net === third.net) {
              points = { [first.playerId]: 5, [second.playerId]: 2, [third.playerId]: 2 };
            } else {
              points = { [first.playerId]: 5, [second.playerId]: 3, [third.playerId]: 1 };
            }
          }
          
          // Calculate running totals
          const runningTotals: { [id: string]: number } = {};
          currentRound.players.forEach(p => runningTotals[p.id] = 0);
          for (let h = 1; h < activeHole; h++) {
            const holeScores = currentRound.players.map(pl => {
              const gross = currentRound.scores[h]?.[pl.id];
              if (typeof gross !== 'number') return null;
              const strokes = calculateGameStrokes(currentRound, ninePointsGame, h, pl.id);
              return { playerId: pl.id, net: gross - strokes };
            });
            
            if (holeScores.every(s => s !== null)) {
              const sorted = [...holeScores].sort((a, b) => (a?.net ?? 99) - (b?.net ?? 99));
              const [f, s, t] = sorted;
              if (f && s && t) {
                if (f.net === s.net && s.net === t.net) {
                  runningTotals[f.playerId] += 3;
                  runningTotals[s.playerId] += 3;
                  runningTotals[t.playerId] += 3;
                } else if (f.net === s.net) {
                  runningTotals[f.playerId] += 4;
                  runningTotals[s.playerId] += 4;
                  runningTotals[t.playerId] += 1;
                } else if (s.net === t.net) {
                  runningTotals[f.playerId] += 5;
                  runningTotals[s.playerId] += 2;
                  runningTotals[t.playerId] += 2;
                } else {
                  runningTotals[f.playerId] += 5;
                  runningTotals[s.playerId] += 3;
                  runningTotals[t.playerId] += 1;
                }
              }
            }
          }
          
          return (
            <div className="bg-card rounded-2xl shadow-sm border border-indigo-500/50 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-500 p-1.5 rounded text-lg">9️⃣</span>
                  Nine Points
                </h3>
                <span className="text-xs text-muted-foreground">
                  ${ninePointsGame.unitStake}/pt • Hole {activeHole}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {currentRound.players.map(p => {
                  const playerNet = netScores.find(s => s.playerId === p.id);
                  const holePoints = points[p.id] ?? 0;
                  const total = runningTotals[p.id] + (allScored ? holePoints : 0);
                  
                  return (
                    <div key={p.id} className="text-center p-3 bg-muted/50 rounded-xl">
                      <div className="font-medium text-sm text-foreground truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Net: {playerNet?.net !== null ? playerNet?.net : '-'}
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${
                        holePoints === 5 ? 'text-success' :
                        holePoints === 1 ? 'text-destructive' :
                        'text-foreground'
                      }`}>
                        {allScored ? holePoints : '-'}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase mt-1">
                        Total: {total} pts
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-3 text-xs text-center text-muted-foreground">
                {allScored ? '5-3-1 points • Ties split evenly' : 'Enter all scores to see points'}
              </div>
            </div>
          );
        })()}

        {/* FBO Press UI - shown when presses enabled and player is dormie (or dormie on active press) */}
        {fboGames.filter(g => g.config.fbo?.allowPresses).map(fboGame => {
          const isHeadToHead = fboGame.config.fbo?.gameMode === 'headToHead';
          const matchups = fboGame.config.fbo?.headToHeadMatchups || [];
          
          // Only show if we're not on hole 1 or 10 (need history to detect dormie)
          const segmentStartHole = activeHole <= 9 ? 1 : 10;
          if (activeHole === segmentStartHole) return null;
          
          const segment: 'front' | 'back' = activeHole <= 9 ? 'front' : 'back';
          const onBackNine = activeHole > 9;
          
          // HEAD-TO-HEAD MODE: Render per-matchup press buttons
          if (isHeadToHead && matchups.length > 0) {
            // Build list of pressable matchups where one player is dormie
            const pressableMatchups: Array<{
              matchup: { player1Id: string; player2Id: string; unitValue: number };
              dormiePlayerId: string;
              opponentId: string;
              dormiePlayerName: string;
              opponentName: string;
              dotsBehind: number;
              holesRemaining: number;
              segmentDormie: boolean;
              overallDormie: boolean;
            }> = [];
            
            matchups.forEach(matchup => {
              const p1 = currentRound.players.find(p => String(p.id) === String(matchup.player1Id));
              const p2 = currentRound.players.find(p => String(p.id) === String(matchup.player2Id));
              if (!p1 || !p2) return;
              
              // Check segment dormie status
              const segmentDormieStatus = getFBOMatchupDormieStatus(
                currentRound, fboGame, matchup.player1Id, matchup.player2Id, activeHole
              );
              
              // Check overall dormie status (only relevant on back 9)
              const overallDormieStatus = onBackNine 
                ? getFBOMatchupOverallDormieStatus(currentRound, fboGame, matchup.player1Id, matchup.player2Id, activeHole)
                : null;
              
              // Check if player1 is dormie in segment or overall
              if (segmentDormieStatus.player1.isDormie || overallDormieStatus?.player1.isDormie) {
                pressableMatchups.push({
                  matchup,
                  dormiePlayerId: matchup.player1Id,
                  opponentId: matchup.player2Id,
                  dormiePlayerName: p1.name,
                  opponentName: p2.name,
                  dotsBehind: segmentDormieStatus.player1.dotsBehind,
                  holesRemaining: segmentDormieStatus.player1.holesRemaining,
                  segmentDormie: segmentDormieStatus.player1.isDormie,
                  overallDormie: !!overallDormieStatus?.player1.isDormie
                });
              }
              
              // Check if player2 is dormie in segment or overall
              if (segmentDormieStatus.player2.isDormie || overallDormieStatus?.player2.isDormie) {
                pressableMatchups.push({
                  matchup,
                  dormiePlayerId: matchup.player2Id,
                  opponentId: matchup.player1Id,
                  dormiePlayerName: p2.name,
                  opponentName: p1.name,
                  dotsBehind: segmentDormieStatus.player2.dotsBehind,
                  holesRemaining: segmentDormieStatus.player2.holesRemaining,
                  segmentDormie: segmentDormieStatus.player2.isDormie,
                  overallDormie: !!overallDormieStatus?.player2.isDormie
                });
              }
            });
            
            if (pressableMatchups.length === 0) return null;
            
            return (
              <div key={fboGame.id} className="bg-card rounded-2xl shadow-sm border border-amber-500/50 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <span className="bg-amber-500/20 text-amber-500 p-1.5 rounded text-lg">🎱</span>
                    FBO H2H Press Available
                  </h3>
                </div>
                <div className="space-y-3">
                  {pressableMatchups.map((pm, idx) => (
                    <div key={idx} className="p-3 bg-amber-500/10 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">
                          {pm.dormiePlayerName} vs {pm.opponentName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({pm.dotsBehind} behind, {pm.holesRemaining} left)
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Segment Press Button (F9 or B9) */}
                        {pm.segmentDormie && (() => {
                          const segKey = `${fboGame.id}-${pm.dormiePlayerId}-${pm.opponentId}-${segment}`;
                          const isPressed = getH2HPressExists(fboGame.id, pm.dormiePlayerId, pm.opponentId, segment);
                          const isDeclined = declinedPresses.has(segKey);
                          
                          if (isDeclined) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-medium text-center bg-muted text-muted-foreground">
                              Declined {segment === 'front' ? 'F9' : 'B9'}
                            </span>
                          );
                          if (isPressed) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold text-center bg-success text-success-foreground">
                              <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Pressed {segment === 'front' ? 'F9' : 'B9'}</span>
                              <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue}</span>
                            </span>
                          );
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => handleFBOPress(fboGame.id, pm.dormiePlayerId, segment, 1, pm.opponentId)}
                                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors bg-amber-500 text-white hover:bg-amber-600"
                              >
                                Press {segment === 'front' ? 'F9' : 'B9'}
                                <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue}</span>
                              </button>
                              <button
                                onClick={() => setDeclinedPresses(prev => new Set(prev).add(segKey))}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline
                              </button>
                            </div>
                          );
                        })()}
                        
                        {/* Overall Press Button (only on back 9) */}
                        {pm.overallDormie && (() => {
                          const ovrKey = `${fboGame.id}-${pm.dormiePlayerId}-${pm.opponentId}-overall`;
                          const isPressed = getH2HPressExists(fboGame.id, pm.dormiePlayerId, pm.opponentId, 'overall');
                          const isDeclined = declinedPresses.has(ovrKey);
                          
                          if (isDeclined) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-medium text-center bg-muted text-muted-foreground">
                              Declined Overall
                            </span>
                          );
                          if (isPressed) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold text-center bg-success text-success-foreground">
                              <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Pressed Overall</span>
                              <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue}</span>
                            </span>
                          );
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => handleFBOPress(fboGame.id, pm.dormiePlayerId, 'overall', 1, pm.opponentId)}
                                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Press Overall
                                <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue}</span>
                              </button>
                              <button
                                onClick={() => setDeclinedPresses(prev => new Set(prev).add(ovrKey))}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline
                              </button>
                            </div>
                          );
                        })()}
                        
                        {/* Press Both / Decline All (convenience) */}
                        {pm.segmentDormie && pm.overallDormie && (() => {
                          const segKey = `${fboGame.id}-${pm.dormiePlayerId}-${pm.opponentId}-${segment}`;
                          const ovrKey = `${fboGame.id}-${pm.dormiePlayerId}-${pm.opponentId}-overall`;
                          const segPressed = getH2HPressExists(fboGame.id, pm.dormiePlayerId, pm.opponentId, segment);
                          const ovrPressed = getH2HPressExists(fboGame.id, pm.dormiePlayerId, pm.opponentId, 'overall');
                          const segDeclined = declinedPresses.has(segKey);
                          const ovrDeclined = declinedPresses.has(ovrKey);
                          
                          if (segPressed || ovrPressed || segDeclined || ovrDeclined) return null;
                          
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => {
                                  handleFBOPress(fboGame.id, pm.dormiePlayerId, segment, 1, pm.opponentId);
                                  setTimeout(() => {
                                    handleFBOPress(fboGame.id, pm.dormiePlayerId, 'overall', 1, pm.opponentId);
                                  }, 50);
                                }}
                                className="flex-1 px-3 py-2 bg-gradient-to-r from-amber-500 to-primary text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                              >
                                Press Both
                                <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue * 2}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setDeclinedPresses(prev => {
                                    const next = new Set(prev);
                                    next.add(segKey);
                                    next.add(ovrKey);
                                    return next;
                                  });
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline All
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Double-or-nothing for remaining holes in matchup
                </p>
              </div>
            );
          }
          
          // ALL TOGETHER MODE: Existing pool-based press UI
          const fboPlayerIds = fboGame.config.fboPlayers || currentRound.players.map(p => p.id);
          const fboPlayers = currentRound.players.filter(p => fboPlayerIds.includes(p.id));
          
          // Find players who can press Front/Back segment
          const backPressEligiblePlayers = fboPlayers.map(p => ({
            player: p,
            eligibility: getFBOPressEligibility(currentRound, fboGame, p.id, segment, activeHole)
          })).filter(({ eligibility }) => eligibility.canPress);
          
          // Find players who can press Overall (only on back 9)
          const overallPressEligiblePlayers = onBackNine 
            ? fboPlayers.map(p => ({
                player: p,
                eligibility: getFBOPressEligibilityOverall(currentRound, fboGame, p.id, activeHole)
              })).filter(({ eligibility }) => eligibility.canPress)
            : [];
          
          // Combine unique players
          const allEligiblePlayerIds = new Set([
            ...backPressEligiblePlayers.map(p => p.player.id),
            ...overallPressEligiblePlayers.map(p => p.player.id)
          ]);
          
          if (allEligiblePlayerIds.size === 0) return null;
          
          return (
            <div key={fboGame.id} className="bg-card rounded-2xl shadow-sm border border-amber-500/50 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-500 p-1.5 rounded text-lg">🎱</span>
                  FBO Press Available
                </h3>
              </div>
              <div className="space-y-3">
                {fboPlayers.filter(p => allEligiblePlayerIds.has(p.id)).map(player => {
                  const backElig = backPressEligiblePlayers.find(e => e.player.id === player.id);
                  const overallElig = overallPressEligiblePlayers.find(e => e.player.id === player.id);
                  const dormieStatus = getFBODormieStatus(currentRound, fboGame, activeHole);
                  const overallDormieStatus = onBackNine ? getFBOOverallDormieStatus(currentRound, fboGame, activeHole) : null;
                  
                  const backStatus = dormieStatus[player.id];
                  const overallStatus = overallDormieStatus?.[player.id];
                  
                  const canPressBack = !!backElig?.eligibility.canPress;
                  const canPressOverall = !!overallElig?.eligibility.canPress;
                  
                  const backPressLabel = backElig?.eligibility.pressLevel === 1 ? 'Press' : 
                                         backElig?.eligibility.pressLevel === 2 ? 'Double' : 
                                         `${backElig?.eligibility.pressLevel}x`;
                  const overallPressLabel = overallElig?.eligibility.pressLevel === 1 ? 'Press' : 
                                            overallElig?.eligibility.pressLevel === 2 ? 'Double' : 
                                            `${overallElig?.eligibility.pressLevel}x`;
                  
                  return (
                    <div key={player.id} className="p-3 bg-amber-500/10 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">{player.name}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Back 9 Press Button */}
                        {canPressBack && (() => {
                          const segKey = `${fboGame.id}-${player.id}-${segment}`;
                          const isPressed = getPoolPressExists(fboGame.id, player.id, segment);
                          const isDeclined = declinedPresses.has(segKey);
                          
                          if (isDeclined) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-medium text-center bg-muted text-muted-foreground">
                              Declined {activeHole <= 9 ? 'F9' : 'B9'}
                            </span>
                          );
                          if (isPressed) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold text-center bg-success text-success-foreground">
                              <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Pressed {activeHole <= 9 ? 'F9' : 'B9'}</span>
                              <span className="block text-xs font-normal opacity-80">${fboGame.unitStake}</span>
                            </span>
                          );
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => handleFBOPress(fboGame.id, player.id, segment, backElig!.eligibility.pressLevel)}
                                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors bg-amber-500 text-white hover:bg-amber-600"
                              >
                                {backPressLabel} {activeHole <= 9 ? 'F9' : 'B9'}
                                <span className="block text-xs font-normal opacity-80">${fboGame.unitStake}</span>
                              </button>
                              <button
                                onClick={() => setDeclinedPresses(prev => new Set(prev).add(segKey))}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline
                              </button>
                            </div>
                          );
                        })()}
                        
                        {/* Overall Press Button (only on back 9) */}
                        {canPressOverall && (() => {
                          const ovrKey = `${fboGame.id}-${player.id}-overall`;
                          const isPressed = getPoolPressExists(fboGame.id, player.id, 'overall');
                          const isDeclined = declinedPresses.has(ovrKey);
                          
                          if (isDeclined) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-medium text-center bg-muted text-muted-foreground">
                              Declined Overall
                            </span>
                          );
                          if (isPressed) return (
                            <span className="flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold text-center bg-success text-success-foreground">
                              <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Pressed Overall</span>
                              <span className="block text-xs font-normal opacity-80">${fboGame.unitStake}</span>
                            </span>
                          );
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => handleFBOPress(fboGame.id, player.id, 'overall', overallElig!.eligibility.pressLevel)}
                                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {overallPressLabel} Overall
                                <span className="block text-xs font-normal opacity-80">${fboGame.unitStake}</span>
                              </button>
                              <button
                                onClick={() => setDeclinedPresses(prev => new Set(prev).add(ovrKey))}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline
                              </button>
                            </div>
                          );
                        })()}
                        
                        {/* Press Both / Decline All (convenience) */}
                        {canPressBack && canPressOverall && (() => {
                          const segKey = `${fboGame.id}-${player.id}-${segment}`;
                          const ovrKey = `${fboGame.id}-${player.id}-overall`;
                          const segPressed = getPoolPressExists(fboGame.id, player.id, segment);
                          const ovrPressed = getPoolPressExists(fboGame.id, player.id, 'overall');
                          const segDeclined = declinedPresses.has(segKey);
                          const ovrDeclined = declinedPresses.has(ovrKey);
                          
                          if (segPressed || ovrPressed || segDeclined || ovrDeclined) return null;
                          
                          return (
                            <div className="flex gap-1 flex-1 min-w-[100px]">
                              <button
                                onClick={() => {
                                  handleFBOPress(fboGame.id, player.id, segment, backElig!.eligibility.pressLevel);
                                  setTimeout(() => {
                                    handleFBOPress(fboGame.id, player.id, 'overall', overallElig!.eligibility.pressLevel);
                                  }, 50);
                                }}
                                className="flex-1 px-3 py-2 bg-gradient-to-r from-amber-500 to-primary text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                              >
                                Press Both
                                <span className="block text-xs font-normal opacity-80">${fboGame.unitStake * 2}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setDeclinedPresses(prev => {
                                    const next = new Set(prev);
                                    next.add(segKey);
                                    next.add(ovrKey);
                                    return next;
                                  });
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-border text-muted-foreground hover:bg-muted"
                              >
                                Decline All
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Status info */}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {canPressBack && backStatus && (
                          <span className="mr-3">
                            {segment === 'front' ? 'F9' : 'B9'}: {backStatus.dotsBehind} behind • {backStatus.holesRemaining} left
                          </span>
                        )}
                        {canPressOverall && overallStatus && (
                          <span>
                            Overall: {overallStatus.dotsBehind} behind • {overallStatus.holesRemaining} left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Double-or-nothing for remaining holes
              </p>
            </div>
          );
        })}

        {/* Stockton 6's Dots Input */}
        {stockton6Game && (() => {
          const stretch = getStretchForHole(activeHole);
          const teamAssignment = getTeamAssignment(currentRound.gameData, stockton6Game.id, stretch);
          if (!teamAssignment) return null;
          
          const dotsData: { [playerId: string]: import('@/types').PlayerHoleDots } = {};
          currentRound.players.forEach(p => {
            const playerDots = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots?.[p.id] || {};
            dotsData[p.id] = playerDots;
          });

          // Calculate Greenie carryover based on previous Par 3 holes
          const calculateGreenieCarryover = (): { carryover: number; isRolloverHole: boolean } => {
            // Find all Par 3 holes up to (but not including) current hole
            const par3Holes = currentRound.course.holes
              .filter(h => h.par === 3 && h.number < activeHole)
              .map(h => h.number);
            
            // Also check if current is last Par 3 and if carryover needs to roll to next hole
            const allPar3s = currentRound.course.holes.filter(h => h.par === 3).map(h => h.number);
            const lastPar3 = allPar3s.length > 0 ? Math.max(...allPar3s) : 0;
            
            // Count only the number of consecutive Par 3 holes where no one got a Greenie
            let missedPar3Count = 0;
            
            for (const par3Hole of par3Holes) {
              // Check if any player got a Greenie on this Par 3
              const holeDots = currentRound.gameData?.[stockton6Game.id]?.[par3Hole]?.dots || {};
              const anyoneGotGreenie = currentRound.players.some(p => holeDots[p.id]?.greenie);
              
              if (!anyoneGotGreenie) {
                missedPar3Count++;
              } else {
                missedPar3Count = 0; // Reset after someone gets a Greenie
              }
            }
            
            // Check if this is a rollover hole (not Par 3, but after last Par 3 with unclaimed greenie)
            let isRolloverHole = false;
            if (courseHole?.par !== 3 && activeHole === lastPar3 + 1) {
              const lastPar3Dots = currentRound.gameData?.[stockton6Game.id]?.[lastPar3]?.dots || {};
              const anyoneGotGreenieOnLast = currentRound.players.some(p => lastPar3Dots[p.id]?.greenie);
              if (!anyoneGotGreenieOnLast && missedPar3Count > 0) {
                isRolloverHole = true;
              }
            }
            
            // Return the count of missed Par 3s (rollover hole doesn't add to count)
            // For Par 3 holes, add 1 for the current opportunity
            const carryover = courseHole?.par === 3 
              ? (missedPar3Count > 0 ? missedPar3Count + 1 : 1)
              : (missedPar3Count > 0 ? missedPar3Count : 1);
            
            return { carryover, isRolloverHole };
          };
          
          const greenieResult = calculateGreenieCarryover();
          
          return (
            <Stockton6DotsInput
              players={currentRound.players}
              hole={activeHole}
              holePar={courseHole?.par || 4}
              dotsData={dotsData}
              teamA={teamAssignment.teamA}
              teamB={teamAssignment.teamB}
              greenieCarryover={greenieResult.carryover}
              isGreenieRolloverHole={greenieResult.isRolloverHole}
              onToggleBirdie={(playerId) => {
                const existingDotsObj = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots || {};
                const currentPlayerDots = existingDotsObj[playerId] || {};
                const updatedPlayerDots = { ...currentPlayerDots, birdie: !currentPlayerDots.birdie };
                const updatedDotsObj = { ...existingDotsObj, [playerId]: updatedPlayerDots };
                updateGameData(stockton6Game.id, activeHole, 'dots', updatedDotsObj);
              }}
              onToggleGreenie={(playerId) => {
                const existingDotsObj = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots || {};
                const currentPlayerDots = existingDotsObj[playerId] || {};
                const updatedPlayerDots = { ...currentPlayerDots, greenie: !currentPlayerDots.greenie };
                const updatedDotsObj = { ...existingDotsObj, [playerId]: updatedPlayerDots };
                updateGameData(stockton6Game.id, activeHole, 'dots', updatedDotsObj);
              }}
              onSetDotMultiplier={(playerId, multiplier) => {
                const existingDotsObj = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots || {};
                const currentPlayerDots = existingDotsObj[playerId] || {};
                const updatedPlayerDots = { ...currentPlayerDots, dotMultiplier: multiplier };
                const updatedDotsObj = { ...existingDotsObj, [playerId]: updatedPlayerDots };
                updateGameData(stockton6Game.id, activeHole, 'dots', updatedDotsObj);
              }}
            />
          );
        })()}

        {/* Player Cards */}
        {currentRound.players.map(p => {
          const rawScore = currentRound.scores[activeHole]?.[p.id];
          const hasScore = rawScore !== undefined && rawScore !== null;
          const displayScore = hasScore ? rawScore : (courseHole?.par || '-');
          const manualStrokes = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[p.id];

          // Determine banker context for relative stroke calculation
          const activeBankerGame = bankerGames[0];
          let currentBankerId: string | null = null;
          let banker: typeof p | undefined = undefined;
          
          if (activeBankerGame) {
            const holeData = currentRound.gameData?.[activeBankerGame.id]?.[activeHole] || {};
            currentBankerId = holeData['_META_BANKER_ID'] || null;
            banker = currentRound.players.find(pl => pl.id === currentBankerId);
          }

          const isBanker = currentBankerId === p.id;
          
          // Calculate auto strokes based on game configuration
          let autoPlayerStrokes = 0;
          let autoBankerStrokes = 0;
          
          // Stockton 6's always uses its own stroke calculation (not configurable)
          if (stockton6Game && courseHole) {
            const relativeStrokes = calculateRelativeStrokes(currentRound.players, courseHole.handicapIndex);
            autoPlayerStrokes = relativeStrokes[p.id] || 0;
          }
          // For Banker games, calculate strokes based on game's handicap config
          else if (activeBankerGame && banker && !isBanker && courseHole) {
            if (activeBankerGame.config.useHandicaps) {
              if (activeBankerGame.config.handicapMode === 'absolute') {
                // Stockton 6 style for Banker game
                const allPlayersGetStrokes = currentRound.players.every(
                  (pl) => courseHole.handicapIndex <= pl.courseHandicap
                );
                if (!allPlayersGetStrokes) {
                  autoPlayerStrokes = courseHole.handicapIndex <= p.courseHandicap ? 1 : 0;
                  autoBankerStrokes = courseHole.handicapIndex <= banker.courseHandicap ? 1 : 0;
                }
              } else {
                // Relative mode (default Banker style)
                const matchupStrokes = calculateBankerMatchupStrokes(
                  p.courseHandicap,
                  banker.courseHandicap,
                  courseHole.handicapIndex
                );
                autoPlayerStrokes = matchupStrokes.playerStrokes;
                autoBankerStrokes = matchupStrokes.bankerStrokes;
              }
            }
            // If useHandicaps is false, both autoPlayerStrokes and autoBankerStrokes remain 0
          }
          // For other games (Skins, Nassau, FBO, etc.), use calculateGameStrokes
          else if (!stockton6Game && !activeBankerGame) {
            // Find the first non-Stockton game to determine handicap config
            const otherGames = currentRound.games.filter(g => 
              g.type !== GameType.STOCKTON_6 && 
              g.type !== GameType.BANKER && 
              g.type !== GameType.BLOODY_BANKER
            );
            if (otherGames.length > 0 && courseHole) {
              // Use the first game's handicap config for display
              autoPlayerStrokes = calculateGameStrokes(currentRound, otherGames[0], activeHole, p.id);
            }
          }
          
          // Use manual strokes if explicitly set, otherwise use auto-calculated
          const effectivePlayerStrokes = manualStrokes !== undefined && manualStrokes !== null 
            ? manualStrokes 
            : autoPlayerStrokes;
          const isPlayerStroking = effectivePlayerStrokes > 0;
          const isBankerStroking = autoBankerStrokes > 0 && manualStrokes === undefined;

          // Calculate net score - for display, show player's perspective
          // If banker gets strokes, player is at disadvantage (their effective score is higher relative to banker)
          const net = rawScore ? rawScore - effectivePlayerStrokes : '-';

          let bankerData = null;
          if (currentBankerId && activeBankerGame) {
            const holeData = currentRound.gameData?.[activeBankerGame.id]?.[activeHole] || {};
            const playerMult = holeData[p.id] || 1;
            const bankerMult = holeData['_META_BANKER_MULT'] || 1;
            const totalBet = activeBankerGame.unitStake * playerMult * bankerMult;
            bankerData = { isBanker, playerMult, totalBet, gameId: activeBankerGame.id };
          }

          const playerTeam = getPlayerTeamColor(p.id);
          
          return (
            <div key={p.id} ref={el => { playerCardRefs.current[p.id] = el; }} className={`rounded-2xl shadow-sm border overflow-hidden ${
              isBanker 
                ? 'border-brand-gold ring-2 ring-brand-gold/20 bg-card' 
                : playerTeam === 'A'
                ? 'border-primary/30 bg-primary/10'
                : playerTeam === 'B'
                ? 'border-destructive/30 bg-destructive/10'
                : 'border-border bg-card'
            }`}>
              <div className={`p-4 flex items-center justify-between border-b ${
                isBanker 
                  ? 'bg-brand-gold/10 border-brand-gold/20' 
                  : playerTeam === 'A'
                  ? 'bg-primary/15 border-primary/20'
                  : playerTeam === 'B'
                  ? 'bg-destructive/15 border-destructive/20'
                  : 'border-border'
              }`}>
                <div className="flex items-center gap-3">
                  {isBanker && <Crown className="w-5 h-5 text-brand-gold fill-current" />}
                  {!isBanker && playerTeam && (
                    <div className={`w-3 h-3 rounded-full ${
                      playerTeam === 'A' ? 'bg-primary' : 'bg-destructive'
                    }`} />
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                      {p.name}
                    </h3>
                    <div className="flex gap-2 text-xs font-bold mt-1">
                      <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">{p.courseHandicap} CH</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Manual Stroke Checkbox - shows player gets stroke */}
                  {/* Show for: Banker games (non-banker), Stockton 6, or any game with useHandicaps enabled */}
                  {(() => {
                    // Determine if any game has handicaps enabled
                    const hasHandicapGame = currentRound.games.some(g => 
                      g.type === GameType.STOCKTON_6 || 
                      (g.config.useHandicaps && g.type !== GameType.OPEN_BETTING)
                    );
                    const showStrokeCheckbox = 
                      ((!isBanker && bankerGames.length > 0 && bankerGames[0].config.useHandicaps) || 
                       stockton6Game || 
                       (hasHandicapGame && !bankerGames.length));
                    
                    if (!showStrokeCheckbox) return null;
                    
                    return (
                      <div className="flex flex-col items-end gap-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">
                          {isBankerStroking ? 'Banker +1' : 'Stroke'}
                        </label>
                        <button 
                          onClick={() => handleStrokeToggle(p.id, autoPlayerStrokes)}
                          className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${
                            isPlayerStroking ? 'bg-primary border-primary' : 
                            isBankerStroking ? 'bg-destructive/20 border-destructive' :
                            'bg-background border-border'
                          }`}
                        >
                          {isPlayerStroking && <CheckSquare className="w-4 h-4 text-primary-foreground" />}
                          {isBankerStroking && <span className="text-xs font-bold text-destructive">B</span>}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Net Score Badge */}
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Net</span>
                    <div className="relative">
                      <span className="text-2xl font-bold text-foreground">{net}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Controls */}
              <div className={`grid grid-cols-3 divide-x divide-border bg-muted/50 h-16 ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                <button 
                  onClick={() => handleScoreChange(p.id, -1)}
                  disabled={isReadOnly}
                  className="flex items-center justify-center active:bg-muted"
                >
                  <span className="text-3xl text-primary font-light">-</span>
                </button>
                <button 
                  onClick={() => handleScoreClick(p.id, typeof displayScore === 'number' ? displayScore : courseHole?.par || 0)}
                  disabled={isReadOnly}
                  className="flex items-center justify-center bg-card active:bg-muted"
                >
                  <span className={`text-3xl font-bold ${!hasScore ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {displayScore}
                  </span>
                </button>
                <button 
                  onClick={() => handleScoreChange(p.id, 1)}
                  disabled={isReadOnly}
                  className="flex items-center justify-center active:bg-muted"
                >
                  <span className="text-3xl text-primary font-light">+</span>
                </button>
              </div>

              {/* Team Banker Multiplier Controls */}
              {(() => {
                const tbGame = currentRound.games.find(g => g.type === GameType.TEAM_BANKER);
                if (!tbGame) return null;
                const tbMode = getTeamBankerMode(currentRound.gameData, tbGame.id);
                const tbStretch = getTeamBankerStretchForHole(activeHole, tbMode);
                const tbAssignment = getTeamBankerTeamAssignment(currentRound.gameData, tbGame.id, tbStretch, tbMode);
                if (!tbAssignment) return null;
                
                const tbHoleData = currentRound.gameData?.[tbGame.id]?.[activeHole] || {};
                const playerMult = tbHoleData[p.id] || 1;
                const allPlayerIds = [...tbAssignment.teamA, ...tbAssignment.teamB];
                const compoundMult = allPlayerIds.reduce((acc, pid) => acc * (tbHoleData[pid] || 1), 1);
                const currentBet = tbAssignment.unitValue * compoundMult;
                
                return (
                  <div className="border-t border-border bg-emerald-500/5 p-2">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Team Banker (${currentBet}/player)</span>
                    </div>
                    <div className="flex gap-1">
                      {[2, 3, 4].map(mult => {
                        const isActive = playerMult === mult;
                        const label = mult === 2 ? 'Double' : (mult === 3 ? 'Triple' : 'PreQuad');
                        return (
                          <button
                            key={mult}
                            onClick={() => {
                              updateGameData(tbGame.id, activeHole, p.id, isActive ? 1 : mult);
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary'}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Banker Game Controls */}
              {bankerData && !bankerData.isBanker && (
                <div className="border-t border-border bg-brand-gold/5 p-2">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vs Banker (${bankerData.totalBet})</span>
                  </div>
                  <div className="flex gap-1">
                    {[2, 3, 4].map(mult => {
                      const isActive = bankerData!.playerMult === mult;
                      const label = mult === 2 ? 'Double' : (mult === 3 ? 'Triple' : 'PreQuad');
                      return (
                        <button
                          key={mult}
                          onClick={() => handleBankerMultiplier(bankerData!.gameId, p.id, isActive ? 1 : mult)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Open Betting Controls */}
              {openBetGames.map(game => {
                const currentBet = currentRound.gameData?.[game.id]?.[activeHole]?.[p.id] || 0;
                const isPositive = currentBet > 0;
                const isNegative = currentBet < 0;

                return (
                  <div key={game.id} className="border-t border-border bg-muted/30 p-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Side Bets
                    </span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleOpenBetChange(game.id, p.id, -5)}
                        className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-destructive font-bold active:bg-destructive/10"
                      >
                        -5
                      </button>
                      <button 
                        onClick={() => handleOpenBetChange(game.id, p.id, -1)}
                        className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground font-bold active:bg-muted"
                      >
                        -1
                      </button>
                      <div className="w-12 text-center font-bold text-sm">
                        <span className={isPositive ? 'text-success' : (isNegative ? 'text-destructive' : 'text-muted-foreground')}>
                          {currentBet > 0 ? '+' : ''}{currentBet}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleOpenBetChange(game.id, p.id, 1)}
                        className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground font-bold active:bg-muted"
                      >
                        +1
                      </button>
                      <button 
                        onClick={() => handleOpenBetChange(game.id, p.id, 5)}
                        className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-success font-bold active:bg-success/10"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      )}


      {/* Floating Bottom Drawer / Summary Teaser */}
      <div className={`fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300 z-50 ${isBottomBarMinimized ? 'pb-safe' : 'p-4 pb-safe'}`}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsBottomBarMinimized(!isBottomBarMinimized)}
          className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border border-b-0 rounded-t-lg px-4 py-1 shadow-sm"
        >
          {isBottomBarMinimized ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {/* Minimized State - Just a thin bar */}
        {isBottomBarMinimized && (
          <div className="h-2" />
        )}
        
        {/* Expanded State - Full Content with Per-Game Breakdown */}
        {!isBottomBarMinimized && (
          <>
            <div className="flex justify-between items-center text-sm font-bold text-muted-foreground mb-3">
              <span>Round Totals</span>
              <span>Live Bets</span>
            </div>
            
            {/* Header row with player initials */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
              <div className="min-w-[60px]" /> {/* Spacer for label column */}
              {currentRound.players.map(p => (
                <div key={p.id} className="flex flex-col items-center min-w-[50px]">
                  <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-bold border border-border">
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Strokes row */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-1">
              <div className="min-w-[60px] text-[10px] text-muted-foreground font-bold uppercase flex items-center">Strokes</div>
              {currentRound.players.map(p => (
                <div key={p.id} className="flex flex-col items-center min-w-[50px]">
                  <span className="text-xs font-mono text-muted-foreground">{getPlayerTotalGross(p.id)}</span>
                </div>
              ))}
            </div>

            {/* Per-game rows */}
            {(() => {
              const perGameResults = calculatePerGameTotals(currentRound);
              const getGameDisplayName = (type: GameType): string => {
                switch (type) {
                  case GameType.BANKER:
                  case GameType.BLOODY_BANKER:
                    return 'Banker';
                  case GameType.SIXES:
                    return "6's";
                  case GameType.STOCKTON_6:
                    return "S6's";
                  case GameType.FBO:
                    return 'FBO';
                  case GameType.SKINS:
                    return 'Skins';
                  case GameType.NASSAU:
                    return 'Nassau';
                  case GameType.WOLF:
                    return 'Wolf';
                  case GameType.NINE_POINTS:
                    return '9 Pts';
                  case GameType.OPEN_BETTING:
                    return 'Bets';
                  case GameType.TEAM_BANKER:
                    return 'TB';
                  default:
                    return type;
                }
              };
              
              return perGameResults.map(gameResult => {
                // Skip games where all players have $0
                const hasActivity = Object.values(gameResult.playerResults).some(v => v !== 0);
                if (!hasActivity) return null;
                
                const displayName = getGameDisplayName(gameResult.gameType);
                const fboGame = currentRound.games.find(g => g.id === gameResult.gameId);
                
                return (
                  <div key={gameResult.gameId} className="flex gap-2 overflow-x-auto no-scrollbar mb-1">
                    <div className="min-w-[60px] text-[10px] text-muted-foreground font-bold uppercase truncate flex items-center">{displayName}</div>
                    {currentRound.players.map(p => {
                      const amount = gameResult.playerResults[p.id] || 0;
                      // Check if player participates in this game (for FBO which may be subset)
                      const participates = gameResult.gameType !== GameType.FBO || 
                        fboGame?.config.fboPlayers?.includes(p.id);
                      
                      return (
                        <div key={p.id} className="flex flex-col items-center min-w-[50px]">
                          {participates ? (
                            <span className={`text-xs font-mono font-bold ${amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {amount > 0 ? '+' : ''}{amount !== 0 ? `$${Math.abs(amount)}`.replace('$', amount < 0 ? '-$' : '$') : '$0'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {/* Total row */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-border mt-2">
              <div className="min-w-[60px] text-[10px] text-foreground font-bold uppercase flex items-center">Total</div>
              {currentRound.players.map(p => {
                const total = roundTotals[p.id] || 0;
                return (
                  <div key={p.id} className="flex flex-col items-center min-w-[50px]">
                    <span className={`text-sm font-mono font-bold ${total > 0 ? 'text-success' : total < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {total > 0 ? '+' : ''}{total !== 0 ? `$${Math.abs(total)}`.replace('$', total < 0 ? '-$' : '$') : '$0'}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Tournament Tab Panel */}
      {!stockton6NeedsSetup && !sixesNeedsSetup && !teamBankerNeedsSetup && tournamentGroupId && activeTab === 'tournament' && (
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto p-4 space-y-4 ${
            isBottomBarMinimized ? 'pb-16' : 'pb-48'
          }`}
        >
          <TournamentTabPanel
            tournamentName={tournamentOverlay.tournamentName}
            roundName={tournamentOverlay.roundName}
            teamMatchup={tournamentOverlay.teamMatchup}
            teams={tournamentOverlay.teams}
            teamTotals={tournamentOverlay.teamTotals}
            holesPlayed={tournamentOverlay.holesPlayed}
            matchState={tournamentOverlay.matchState}
            holeResults={tournamentOverlay.holeResults}
            courseHoles={tournamentOverlay.courseHoles}
            tournamentGame={tournamentOverlay.tournamentGame}
            tournamentPlayers={tournamentOverlay.tournamentPlayers}
            teamAssignments={tournamentOverlay.teamAssignments}
            allHoleScores={tournamentOverlay.allHoleScores}
            segmentTotals={tournamentOverlay.segmentTotals}
            newlyCompletedHole={tournamentOverlay.newlyCompletedHole}
            tournamentId={meta?.tournamentId}
            subMatchups={tournamentOverlay.subMatchups}
          />
        </div>
      )}

      {/* Bloody Banker Activation Dialog */}
      <AlertDialog open={!!showBloodyActivateDialog} onOpenChange={(open) => { if (!open) setShowBloodyActivateDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🩸 Activate Bloody Banker?</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached hole 16! Want to activate Bloody Banker rules for holes 16, 17, and 18? 
              The player who is down the most will get to set the stakes for the remaining holes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (showBloodyActivateDialog) {
                updateGameData(showBloodyActivateDialog, 0, '_META_BLOODY_ACTIVATED', false);
              }
              setShowBloodyActivateDialog(null);
            }}>
              No, Keep Standard
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (showBloodyActivateDialog) {
                updateGameData(showBloodyActivateDialog, 0, '_META_BLOODY_ACTIVATED', true);
              }
              setShowBloodyActivateDialog(null);
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Go Bloody!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActiveRound;