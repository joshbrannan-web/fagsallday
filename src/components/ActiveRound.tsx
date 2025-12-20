import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../App';
import { ChevronLeft, ChevronRight, Mic, Menu, DollarSign, FileText, Crown, Home, CheckSquare, Flag } from 'lucide-react';
import { getNetScore, calculateStrokesReceived } from '../services/gameEngine';
import { validateHoleInput, interpretVoiceCommand } from '../services/aiAssistant';
import { GameType } from '../types';

const ActiveRound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRound, updateScore, updateGameData, roundTotals } = useApp();
  
  // Initialize active hole from navigation state if available
  const [activeHole, setActiveHole] = useState(() => {
    const state = location.state as { startHole?: number } | null;
    return state?.startHole || 1;
  });
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!currentRound) {
      // Allow the component to render the empty state
    }
  }, [currentRound, navigate]);

  if (!currentRound) {
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
  const openBetGames = currentRound.games.filter(g => g.type === GameType.OPEN_BETTING);
  const bankerGames = currentRound.games.filter(g => g.type === GameType.BANKER);

  // Voice Input Logic
  const handleVoiceInput = () => {
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
    const current = currentRound.scores[activeHole]?.[pid] || courseHole!.par;
    const newScore = Math.max(1, current + delta);
    const player = currentRound.players.find(p => p.id === pid)!;
    const validation = validateHoleInput(newScore, courseHole!.par, player);
    if (validation.severity === 'warning') {
      console.warn(validation.message);
    }
    updateScore(activeHole, pid, newScore);
  };

  const handleStrokeToggle = (pid: string, courseHandicap: number) => {
    const manualStrokes = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[pid];
    const naturalStrokes = calculateStrokesReceived(courseHandicap, courseHole!.handicapIndex);
    const currentEffective = manualStrokes !== undefined && manualStrokes !== null ? manualStrokes : naturalStrokes;
    
    let newValue: number | null = 0;
    if (currentEffective > 0) {
      newValue = 0;
    } else {
      if (naturalStrokes > 0) {
        newValue = null; 
      } else {
        newValue = 1;
      }
    }
    updateGameData('MANUAL_STROKES', activeHole, pid, newValue);
  };

  const handleOpenBetChange = (gameId: string, pid: string, delta: number) => {
    const current = currentRound.gameData?.[gameId]?.[activeHole]?.[pid] || 0;
    updateGameData(gameId, activeHole, pid, current + delta);
  };

  const handleBankerSelect = (gameId: string, bankerId: string) => {
    updateGameData(gameId, activeHole, '_META_BANKER_ID', bankerId);
  };

  const handleBankerMultiplier = (gameId: string, pid: string, mult: number) => {
    updateGameData(gameId, activeHole, pid, mult);
  };

  const handleBankerPressAll = (gameId: string, currentMult: number) => {
    updateGameData(gameId, activeHole, '_META_BANKER_MULT', currentMult);
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
      {/* Top Bar: Hole Nav */}
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-lg sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <button className="p-2" onClick={() => navigate('/summary')}><Menu className="w-5 h-5" /></button>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold">Hole {activeHole}</h1>
            <div className="flex gap-3 text-xs text-muted-foreground font-mono tracking-wider">
              <span>PAR {courseHole?.par}</span>
              <span className="opacity-50">|</span>
              <span>{courseHole?.yardage} YDS</span>
              <span className="opacity-50">|</span>
              <span>IDX {courseHole?.handicapIndex}</span>
            </div>
          </div>
          <button className={`p-2 rounded-full ${isListening ? 'bg-destructive animate-pulse' : 'bg-muted'}`} onClick={handleVoiceInput}>
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-between items-center gap-4">
          <button 
            disabled={activeHole === 1}
            onClick={() => setActiveHole(h => h - 1)}
            className="bg-muted p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 flex justify-center">
            <button 
              onClick={() => navigate('/scorecard')}
              className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-white/20 transition-colors"
            >
              <FileText className="w-4 h-4" /> Scorecard
            </button>
          </div>
          {activeHole === 18 ? (
            <button 
              onClick={() => navigate('/summary')}
              className="bg-brand-gold p-3 rounded-xl shadow-lg animate-pulse"
            >
              <Flag className="w-6 h-6 text-brand-dark" />
            </button>
          ) : (
            <button 
              onClick={() => setActiveHole(h => h + 1)}
              className="bg-primary p-3 rounded-xl disabled:opacity-30"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scoring Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
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
                {currentRound.players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleBankerSelect(game.id, p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${bankerId === p.id ? 'bg-brand-gold text-brand-dark border-brand-gold shadow-md scale-105' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${bankerId === p.id ? 'bg-brand-dark' : 'bg-muted-foreground/50'}`}></div>
                    <span className="font-bold text-sm">{p.name}</span>
                  </button>
                ))}
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

        {/* Player Cards */}
        {currentRound.players.map(p => {
          const rawScore = currentRound.scores[activeHole]?.[p.id];
          const hasScore = rawScore !== undefined && rawScore !== null;
          const displayScore = hasScore ? rawScore : (courseHole?.par || '-');
          const manualStrokes = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[p.id];
          const net = rawScore ? getNetScore(rawScore, courseHole!.par, courseHole!.handicapIndex, p.courseHandicap, manualStrokes) : '-';

          const naturalStrokes = calculateStrokesReceived(p.courseHandicap, courseHole!.handicapIndex);
          const effectiveStrokes = manualStrokes !== undefined && manualStrokes !== null ? manualStrokes : naturalStrokes;
          const isStroking = effectiveStrokes > 0;
          const isManual = manualStrokes !== undefined && manualStrokes !== null;

          let bankerData = null;
          let isBanker = false;
          const activeBankerGame = bankerGames[0];
          if (activeBankerGame) {
            const holeData = currentRound.gameData?.[activeBankerGame.id]?.[activeHole] || {};
            const currentBankerId = holeData['_META_BANKER_ID'];
            isBanker = currentBankerId === p.id;
            if (currentBankerId) {
              const playerMult = holeData[p.id] || 1;
              const bankerMult = holeData['_META_BANKER_MULT'] || 1;
              const totalBet = activeBankerGame.unitStake * playerMult * bankerMult;
              bankerData = { isBanker, playerMult, totalBet, gameId: activeBankerGame.id };
            }
          }

          return (
            <div key={p.id} className={`bg-card rounded-2xl shadow-sm border overflow-hidden ${isBanker ? 'border-brand-gold ring-2 ring-brand-gold/20' : 'border-border'}`}>
              <div className={`p-4 flex items-center justify-between border-b ${isBanker ? 'bg-brand-gold/10 border-brand-gold/20' : 'border-border'}`}>
                <div className="flex items-center gap-3">
                  {isBanker && <Crown className="w-5 h-5 text-brand-gold fill-current" />}
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
                  {/* Manual Stroke Checkbox */}
                  <div className="flex flex-col items-end gap-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stroke</label>
                    <button 
                      onClick={() => handleStrokeToggle(p.id, p.courseHandicap)}
                      className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isStroking ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                    >
                      {isStroking && <CheckSquare className="w-4 h-4 text-primary-foreground" />}
                    </button>
                  </div>

                  {/* Net Score Badge */}
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Net</span>
                    <div className="relative">
                      <span className="text-2xl font-bold text-foreground">{net}</span>
                      {isManual && (
                        <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-brand-gold"></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Controls */}
              <div className="grid grid-cols-3 divide-x divide-border bg-muted/50 h-16">
                <button 
                  onClick={() => handleScoreChange(p.id, -1)}
                  className="flex items-center justify-center active:bg-muted"
                >
                  <span className="text-3xl text-primary font-light">-</span>
                </button>
                <div className="flex items-center justify-center bg-card">
                  <span className={`text-3xl font-bold ${!hasScore ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {displayScore}
                  </span>
                </div>
                <button 
                  onClick={() => handleScoreChange(p.id, 1)}
                  className="flex items-center justify-center active:bg-muted"
                >
                  <span className="text-3xl text-primary font-light">+</span>
                </button>
              </div>

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

      {/* Floating Bottom Drawer / Summary Teaser */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center text-sm font-bold text-muted-foreground mb-2">
          <span>Round Totals</span>
          <span>Live Bets</span>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {currentRound.players.map(p => {
            const totalGross = getPlayerTotalGross(p.id);
            return (
              <div key={p.id} className="flex flex-col items-center min-w-[60px]">
                <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-bold mb-1 border border-border">
                  {p.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col items-center leading-none gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">
                    {totalGross}
                  </span>
                  <span className={`text-xs font-bold ${roundTotals[p.id] > 0 ? 'text-success' : (roundTotals[p.id] < 0 ? 'text-destructive' : 'text-muted-foreground')}`}>
                    {roundTotals[p.id] > 0 ? '+' : (roundTotals[p.id] < 0 ? '-' : '')}${Math.abs(roundTotals[p.id] || 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActiveRound;