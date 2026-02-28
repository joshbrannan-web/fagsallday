import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { formatMoney, calculatePerGameTotals, calculateSettlement } from '../services/gameEngine';
import { Home, Trophy, Share2, Edit2, Check, X, Lock, Unlock, MapPin, Image, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';
import { GameSettings, GameType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ScorecardImage, { ScorecardImageHandle } from './ScorecardImage';
import GreenFeeSplitDialog from './GreenFeeSplitDialog';

const getGameConfigDetails = (game: GameSettings, gameData?: Record<string, any>): string[] => {
  const details: string[] = [];
  const { config, type } = game;
  
  // Handicap settings (most games - 6's handled separately below)
  if (config.useHandicaps !== undefined && type !== GameType.SIXES) {
    details.push(config.useHandicaps ? 'Handicaps: On' : 'Handicaps: Off');
    if (config.useHandicaps) {
      if (type === GameType.FBO) {
        details.push('Mode: Absolute');
      } else if (config.handicapMode) {
        details.push(`Mode: ${config.handicapMode === 'absolute' ? 'Absolute' : 'Relative'}`);
      }
    }
  }
  
  if (type === GameType.SKINS && config.carryovers !== undefined) {
    details.push(config.carryovers ? 'Carryovers: On' : 'Carryovers: Off');
  }
  
  if (type === GameType.NASSAU && config.presses !== undefined) {
    details.push(config.presses ? 'Presses: On' : 'Presses: Off');
  }
  
  if (type === GameType.BANKER || type === GameType.BLOODY_BANKER) {
    if (config.birdieMultiplier && config.birdieMultiplier > 1) {
      details.push(`Birdie: ${config.birdieMultiplier}x`);
    }
    if (config.eagleMultiplier && config.eagleMultiplier > 1) {
      details.push(`Eagle: ${config.eagleMultiplier}x`);
    }
  }
  
  if (type === GameType.STOCKTON_6 && config.stockton6?.dotValue) {
    details.push(`Dots: $${config.stockton6.dotValue}/dot`);
  }
  
  if (type === GameType.SIXES) {
    const sixesData = gameData?.[game.id]?.[1];
    
    if (sixesData) {
      const useHandicaps = sixesData._META_USE_HANDICAPS ?? config.useHandicaps ?? true;
      details.push(useHandicaps ? 'Handicaps: On' : 'Handicaps: Off');
      
      if (useHandicaps) {
        const handicapMode = sixesData._META_HANDICAP_MODE ?? config.handicapMode ?? 'absolute';
        details.push(`Mode: ${handicapMode === 'absolute' ? 'Absolute' : 'Relative'}`);
      }
      
      const useSecondBall = sixesData._META_USE_SECOND_BALL ?? false;
      details.push(useSecondBall ? '2nd Ball Tiebreaker: On' : '2nd Ball Tiebreaker: Off');
      
      const allowPresses = sixesData._META_ALLOW_PRESSES ?? false;
      if (allowPresses) {
        details.push('Presses: On');
      }
    }
  }
  
  if (type === GameType.WOLF && config.wolf?.teesFirst !== undefined) {
    details.push(config.wolf.teesFirst ? 'Wolf Tees First' : 'Wolf Tees Last');
  }
  
  if (type === GameType.TEAM_BANKER) {
    const tbData = gameData?.[game.id]?.[1];
    if (tbData) {
      const useHcp = tbData._META_USE_HANDICAPS ?? config.useHandicaps ?? true;
      details.push(useHcp ? 'Handicaps: On' : 'Handicaps: Off');
      if (useHcp) {
        const hcpMode = tbData._META_HANDICAP_MODE ?? config.handicapMode ?? 'relative';
        details.push(`Mode: ${hcpMode === 'absolute' ? 'Absolute' : 'Relative'}`);
      }
      const useSecondBall = tbData._META_USE_SECOND_BALL ?? false;
      details.push(useSecondBall ? '2nd Ball Tiebreaker: On' : '2nd Ball Tiebreaker: Off');
      const bMult = tbData._META_BIRDIE_MULT ?? config.birdieMultiplier ?? 1;
      if (bMult > 1) details.push(`Birdie: ${bMult}x`);
      const eMult = tbData._META_EAGLE_MULT ?? config.eagleMultiplier ?? 1;
      if (eMult > 1) details.push(`Eagle: ${eMult}x`);
      const tbMode = tbData._META_MODE ?? config.teamBanker?.mode ?? 'sixes';
      details.push(`Rotation: ${tbMode === 'eighteen' ? '18 Holes' : tbMode === 'threes' ? "3's" : "6's"}`);
    }
  }
  
  if (type === GameType.FBO) {
    if (config.fboPlayers?.length) {
      details.push(`${config.fboPlayers.length} players`);
    }
    if (config.fbo?.allowPresses) {
      details.push('Presses: On');
    }
  }
  
  return details;
};

const RoundSummary: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals, finishRound, updateGameDataBatch, updateRoundCourse, lockRound, unlockRound, deleteRound, clearLoadedRound } = useApp();
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, number>>({});
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const scorecardImageRef = useRef<ScorecardImageHandle>(null);
  const [showGreenFeeDialog, setShowGreenFeeDialog] = useState(false);
  
  // Course editing state
  const [editingCourse, setEditingCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseLocation, setEditCourseLocation] = useState('');

  // Initialize adjusted amounts from calculated totals
  useEffect(() => {
    if (currentRound && Object.keys(adjustedAmounts).length === 0) {
      const savedAdjustments = currentRound.gameData?._META?.[0]?._FINAL_ADJUSTMENTS;
      
      if (savedAdjustments && Object.keys(savedAdjustments).length > 0) {
        setAdjustedAmounts(savedAdjustments);
      } else {
        const initial: Record<string, number> = {};
        currentRound.players.forEach(p => {
          initial[p.id] = roundTotals[p.id] || 0;
        });
        setAdjustedAmounts(initial);
      }
    }
  }, [currentRound, roundTotals]);

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Round Data</h2>
        <Button onClick={() => navigate('/')}>
          <Home className="w-5 h-5 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const isLocked = currentRound.status === 'LOCKED';
  const isComplete = currentRound.status === 'COMPLETE';
  const canEdit = isComplete && !isLocked;

  // Count holes where all players have a score > 0
  const completedHoleCount = Object.keys(currentRound.scores || {}).filter(holeNum => 
    currentRound.players.every(p => (currentRound.scores[Number(holeNum)]?.[p.id] || 0) > 0)
  ).length;
  const canChangeGames = currentRound.status === 'ACTIVE' && completedHoleCount < 2;

  const allHolesComplete = (() => {
    for (let hole = 1; hole <= 18; hole++) {
      const holeScores = currentRound.scores[hole];
      if (!holeScores) return false;
      for (const player of currentRound.players) {
        if (holeScores[player.id] === null || holeScores[player.id] === undefined) return false;
      }
    }
    return true;
  })();

  const handleDeleteRound = async () => {
    if (!window.confirm('Delete this round? This cannot be undone.')) return;
    await deleteRound(currentRound.id);
    clearLoadedRound();
    navigate('/');
  };

  const displayAmounts = Object.keys(adjustedAmounts).length > 0 ? adjustedAmounts : roundTotals;

  const sortedPlayers = [...currentRound.players].sort((a, b) => 
    (displayAmounts[b.id] || 0) - (displayAmounts[a.id] || 0)
  );

  const handleStartEdit = (playerId: string) => {
    if (isLocked) return;
    setEditingPlayer(playerId);
    setEditValue(String(displayAmounts[playerId] || 0));
  };

  const handleSaveEdit = () => {
    if (editingPlayer) {
      const newValue = parseFloat(editValue) || 0;
      setAdjustedAmounts(prev => ({
        ...prev,
        [editingPlayer]: newValue
      }));
      setEditingPlayer(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingPlayer(null);
    setEditValue('');
  };

  const handleStartCourseEdit = () => {
    if (!canEdit) return;
    setEditCourseName(currentRound.course.name);
    setEditCourseLocation(currentRound.course.location || '');
    setEditingCourse(true);
  };

  const handleSaveCourseEdit = async () => {
    await updateRoundCourse(editCourseName.trim(), editCourseLocation.trim());
    setEditingCourse(false);
    toast.success('Course info updated');
  };

  const handleCancelCourseEdit = () => {
    setEditingCourse(false);
  };

  const handleLockRound = async () => {
    if (!window.confirm('Lock this round? Once locked, amounts and course info can no longer be edited.')) return;
    
    // Save any pending adjustments before locking
    const hasAdjustments = currentRound.players.some(
      p => adjustedAmounts[p.id] !== roundTotals[p.id]
    );
    if (hasAdjustments) {
      await updateGameDataBatch('_META', 0, { _FINAL_ADJUSTMENTS: adjustedAmounts });
    }
    
    await lockRound();
    toast.success('Round locked!');
  };

  const handleUnlockRound = async () => {
    if (!window.confirm('Unlock this round? This will allow editing amounts and course info again.')) return;
    await unlockRound();
    toast.success('Round unlocked');
  };

  const handleFinish = async () => {
    const hasAdjustments = currentRound.players.some(
      p => adjustedAmounts[p.id] !== roundTotals[p.id]
    );
    
    if (hasAdjustments) {
      await updateGameDataBatch('_META', 0, { _FINAL_ADJUSTMENTS: adjustedAmounts });
    }
    
    await finishRound();
    toast.success('Round saved to history!');
    navigate('/');
  };

  const buildShareText = (greenFee?: { adjustments: Record<string, number>; payerName: string; totalAmount: number; splitCount: number }) => {
    const roundDate = new Date(currentRound.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const getPlayerTotalScore = (playerId: string) => {
      let total = 0;
      Object.values(currentRound.scores).forEach(holeScores => {
        const score = holeScores[playerId];
        if (score !== null && score !== undefined) {
          total += score;
        }
      });
      return total;
    };

    // Merge green fee adjustments into display amounts for settlement
    const finalAmounts: Record<string, number> = {};
    sortedPlayers.forEach(p => {
      finalAmounts[p.id] = (displayAmounts[p.id] || 0) + (greenFee?.adjustments[p.id] || 0);
    });

    const results = sortedPlayers.map((p) => 
      `${p.name}: ${formatMoney(displayAmounts[p.id] || 0)} (${getPlayerTotalScore(p.id)} strokes)`
    ).join('\n');

    let gameBreakdown = '';
    if (currentRound.games.length >= 1) {
      const perGameResults = calculatePerGameTotals(currentRound);
      
      gameBreakdown = '\n\n--- Games Breakdown ---';
      perGameResults.forEach(gameResult => {
        const game = currentRound.games.find(g => g.id === gameResult.gameId);
        if (!game) return;
        
        const hasActivity = Object.values(gameResult.playerResults).some(v => v !== 0);
        if (!hasActivity) return;
        
        const playerLines = sortedPlayers
          .map(p => `  ${p.name}: ${formatMoney(gameResult.playerResults[p.id] || 0)}`)
          .join('\n');
        
        gameBreakdown += `\n${game.name} ($${game.unitStake}/unit):\n${playerLines}`;
      });
    }

    // Green fee section
    let greenFeeText = '';
    if (greenFee) {
      const perPerson = (Math.round((greenFee.totalAmount / greenFee.splitCount) * 100) / 100).toFixed(2);
      greenFeeText = `\n\n--- Green Fees ---\n  ${greenFee.payerName} paid $${greenFee.totalAmount.toFixed(2)} (split ${greenFee.splitCount} ways)\n  Each player: $${perPerson}`;
    }

    // Total payouts (only when green fees are included)
    let totalPayoutsText = '';
    if (greenFee) {
      const totalLines = sortedPlayers.map(p => 
        `${p.name} net: ${formatMoney(finalAmounts[p.id] || 0)}`
      ).join('\n');
      totalPayoutsText = `\n\n--- Total Payouts ---\n${totalLines}`;
    }

    // Settlement plan using final (merged) amounts
    let settlementText = '';
    const playerAmounts = sortedPlayers.map(p => ({
      name: p.name,
      amount: finalAmounts[p.id] || 0
    }));
    const transactions = calculateSettlement(playerAmounts);
    if (transactions.length > 0) {
      const lines = transactions.map(t => `  ${t.from} pays ${t.to} $${t.amount.toFixed(2)}`).join('\n');
      settlementText = `\n\n--- Who Pays Who ---\n${lines}`;
    }

    return `🏌️ ${currentRound.course.name} - ${roundDate}\n\n--- Game $$ Payouts ---\n\n${results}\n\nMoney Shot by F&Gs All Day${gameBreakdown}${greenFeeText}${totalPayoutsText}${settlementText}`;
  };

  const doShare = async (text: string) => {
    if (navigator.share) {
      await navigator.share({ title: 'Golf Round Results', text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Results copied to clipboard!');
    }
  };

  const handleShare = async () => {
    await doShare(buildShareText());
  };

  const handleGreenFeeConfirm = async (adjustments: Record<string, number>, payerName: string, totalAmount: number, splitCount: number) => {
    await doShare(buildShareText({ adjustments, payerName, totalAmount, splitCount }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand-dark text-primary-foreground p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-2 text-brand-gold" />
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">{allHolesComplete ? 'Round Complete' : 'Round Summary'}</h1>
          {isLocked && <Lock className="w-5 h-5 text-brand-gold" />}
        </div>
        
        {editingCourse ? (
          <div className="mt-3 space-y-2 max-w-xs mx-auto">
            <Input
              value={editCourseName}
              onChange={(e) => setEditCourseName(e.target.value)}
              placeholder="Course name"
              className="text-center bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50"
              autoFocus
            />
            <Input
              value={editCourseLocation}
              onChange={(e) => setEditCourseLocation(e.target.value)}
              placeholder="Location"
              className="text-center bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50"
            />
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={handleSaveCourseEdit}>
                <Check className="w-4 h-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={handleCancelCourseEdit}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <button
              onClick={canEdit ? handleStartCourseEdit : undefined}
              className={`inline-flex items-center gap-1 text-sm opacity-80 ${canEdit ? 'hover:opacity-100 cursor-pointer' : 'cursor-default'}`}
            >
              {currentRound.course.name}
              {canEdit && <Edit2 className="w-3 h-3" />}
            </button>
            {currentRound.course.location && (
              <p className="text-xs opacity-60 flex items-center justify-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {currentRound.course.location}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Leaderboard</h2>
            {!isLocked && <span className="text-xs text-muted-foreground">Tap amount to adjust</span>}
          </div>
          {sortedPlayers.map((player, idx) => {
            const amount = displayAmounts[player.id] || 0;
            const isWinner = idx === 0 && amount > 0;
            const isEditing = editingPlayer === player.id;

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                  isWinner ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-brand-gold text-white' :
                    idx === 1 ? 'bg-muted-foreground/50 text-white' :
                    idx === 2 ? 'bg-brand-rust text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="font-semibold">{player.name}</span>
                </div>
                
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-24 h-8 text-right font-mono"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                      <Check className="w-4 h-4 text-success" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => !isLocked && handleStartEdit(player.id)}
                    disabled={isLocked}
                    className={`flex items-center gap-2 text-xl font-bold font-mono ${
                      amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'
                    } ${isLocked ? 'cursor-default' : ''}`}
                  >
                    {formatMoney(amount)}
                    {!isLocked && <Edit2 className="w-4 h-4 opacity-50" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Games Played</h2>
          <div className="space-y-3">
            {currentRound.games.map(game => {
              const configDetails = getGameConfigDetails(game, currentRound?.gameData);
              
              return (
                <div key={game.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold">{game.name}</span>
                    <span className="text-muted-foreground font-mono text-sm">${game.unitStake}/unit</span>
                  </div>
                  {configDetails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {configDetails.map((detail, idx) => (
                        <span 
                          key={idx} 
                          className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ScorecardImage ref={scorecardImageRef} currentRound={currentRound} roundTotals={displayAmounts} />

      <div className="p-4 bg-card border-t border-border space-y-3">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowGreenFeeDialog(true)} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="outline" onClick={() => scorecardImageRef.current?.shareImage()} className="flex-1">
            <Image className="w-4 h-4 mr-2" /> Share Scorecard
          </Button>
        </div>
        <Button variant="outline" onClick={() => navigate('/scorecard')} className="w-full">
          View Scorecard
        </Button>
        {canEdit && (
          <Button variant="outline" onClick={handleLockRound} className="w-full">
            <Lock className="w-4 h-4 mr-2" /> Lock Round
          </Button>
        )}
        {isLocked && (
          <Button variant="outline" onClick={handleUnlockRound} className="w-full">
            <Unlock className="w-4 h-4 mr-2" /> Unlock Round
          </Button>
        )}
        {!allHolesComplete && currentRound.status === 'ACTIVE' && (
          <>
            <Button variant="outline" onClick={() => {
              const firstIncompleteHole = currentRound.course.holes.find(hole => {
                const holeScores = currentRound.scores[hole.number];
                if (!holeScores) return true;
                return !currentRound.players.every(p => {
                  const score = holeScores[p.id];
                  return typeof score === 'number' && score > 0;
                });
              })?.number || 1;
              navigate('/active', { state: { startHole: firstIncompleteHole } });
            }} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to Hole
            </Button>
            {canChangeGames && (
              <Button variant="outline" onClick={() => navigate('/setup', { state: { changeGamesMode: true, existingCourse: currentRound.course, existingPlayers: currentRound.players } })} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" /> Change Games
              </Button>
            )}
            <Button variant="destructive" onClick={handleDeleteRound} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Round
            </Button>
          </>
        )}
        {currentRound.status === 'ACTIVE' && allHolesComplete && (
          <Button onClick={handleFinish} className="w-full">
            <Home className="w-4 h-4 mr-2" /> Finish & Save
          </Button>
        )}
        {(isComplete || isLocked) && (
          <Button onClick={() => navigate('/')} className="w-full">
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
        )}
      </div>

      <GreenFeeSplitDialog
        open={showGreenFeeDialog}
        onOpenChange={setShowGreenFeeDialog}
        players={currentRound.players}
        onSkip={handleShare}
        onConfirm={handleGreenFeeConfirm}
      />
    </div>
  );
};

export default RoundSummary;
