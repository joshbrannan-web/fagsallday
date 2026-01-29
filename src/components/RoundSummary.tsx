import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { formatMoney, calculatePerGameTotals } from '../services/gameEngine';
import { Home, Trophy, Share2, Edit2, Check, X } from 'lucide-react';
import { GameSettings, GameType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const getGameConfigDetails = (game: GameSettings, gameData?: Record<string, any>): string[] => {
  const details: string[] = [];
  const { config, type } = game;
  
  // Handicap settings (most games - 6's handled separately below)
  if (config.useHandicaps !== undefined && type !== GameType.SIXES) {
    details.push(config.useHandicaps ? 'Handicaps: On' : 'Handicaps: Off');
    if (config.useHandicaps) {
      // FBO is always Absolute mode (hardcoded in engine)
      if (type === GameType.FBO) {
        details.push('Mode: Absolute');
      } else if (config.handicapMode) {
        details.push(`Mode: ${config.handicapMode === 'absolute' ? 'Absolute' : 'Relative'}`);
      }
    }
  }
  
  // Skins-specific
  if (type === GameType.SKINS && config.carryovers !== undefined) {
    details.push(config.carryovers ? 'Carryovers: On' : 'Carryovers: Off');
  }
  
  // Nassau-specific
  if (type === GameType.NASSAU && config.presses !== undefined) {
    details.push(config.presses ? 'Presses: On' : 'Presses: Off');
  }
  
  // Banker/Bloody Banker multipliers
  if (type === GameType.BANKER || type === GameType.BLOODY_BANKER) {
    if (config.birdieMultiplier && config.birdieMultiplier > 1) {
      details.push(`Birdie: ${config.birdieMultiplier}x`);
    }
    if (config.eagleMultiplier && config.eagleMultiplier > 1) {
      details.push(`Eagle: ${config.eagleMultiplier}x`);
    }
  }
  
  // Stockton 6's dot value
  if (type === GameType.STOCKTON_6 && config.stockton6?.dotValue) {
    details.push(`Dots: $${config.stockton6.dotValue}/dot`);
  }
  
  // 6's - read from gameData metadata for accurate values
  if (type === GameType.SIXES) {
    // Read from Stretch 1 metadata (hole 1) where settings are stored
    const sixesData = gameData?.[game.id]?.[1];
    
    if (sixesData) {
      // Use Handicaps
      const useHandicaps = sixesData._META_USE_HANDICAPS ?? config.useHandicaps ?? true;
      details.push(useHandicaps ? 'Handicaps: On' : 'Handicaps: Off');
      
      if (useHandicaps) {
        const handicapMode = sixesData._META_HANDICAP_MODE ?? config.handicapMode ?? 'absolute';
        details.push(`Mode: ${handicapMode === 'absolute' ? 'Absolute' : 'Relative'}`);
      }
      
      // 2nd Ball Tiebreaker
      const useSecondBall = sixesData._META_USE_SECOND_BALL ?? false;
      details.push(useSecondBall ? '2nd Ball Tiebreaker: On' : '2nd Ball Tiebreaker: Off');
      
      // Allow Presses
      const allowPresses = sixesData._META_ALLOW_PRESSES ?? false;
      if (allowPresses) {
        details.push('Presses: On');
      }
    }
  }
  
  // Wolf tees first/last
  if (type === GameType.WOLF && config.wolf?.teesFirst !== undefined) {
    details.push(config.wolf.teesFirst ? 'Wolf Tees First' : 'Wolf Tees Last');
  }
  
  // FBO players count and presses
  if (type === GameType.FBO) {
    if (config.fboPlayers?.length) {
      details.push(`${config.fboPlayers.length} players`);
    }
    if (config.fbo?.allowPresses) {
      details.push('Presses: On');
    }
  }
  
  // Nine Points - no special config to show
  
  return details;
};

const RoundSummary: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals, finishRound, updateGameDataBatch } = useApp();
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, number>>({});
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Initialize adjusted amounts from calculated totals
  useEffect(() => {
    if (currentRound && Object.keys(adjustedAmounts).length === 0) {
      // Check for saved final adjustments first
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

  const displayAmounts = Object.keys(adjustedAmounts).length > 0 ? adjustedAmounts : roundTotals;

  const sortedPlayers = [...currentRound.players].sort((a, b) => 
    (displayAmounts[b.id] || 0) - (displayAmounts[a.id] || 0)
  );

  const handleStartEdit = (playerId: string) => {
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

  const handleFinish = async () => {
    // Save final adjusted amounts if any differ from calculated
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

  const handleShare = async () => {
    const roundDate = new Date(currentRound.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Calculate total strokes for each player
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

    const results = sortedPlayers.map((p) => 
      `${p.name}: ${formatMoney(displayAmounts[p.id] || 0)} (${getPlayerTotalScore(p.id)} strokes)`
    ).join('\n');

    // Build per-game breakdown if multiple games
    let gameBreakdown = '';
    if (currentRound.games.length > 1) {
      const perGameResults = calculatePerGameTotals(currentRound);
      
      gameBreakdown = '\n\n--- Games Breakdown ---';
      perGameResults.forEach(gameResult => {
        const game = currentRound.games.find(g => g.id === gameResult.gameId);
        if (!game) return;
        
        // Skip games with no activity
        const hasActivity = Object.values(gameResult.playerResults).some(v => v !== 0);
        if (!hasActivity) return;
        
        const playerLines = sortedPlayers
          .map(p => `  ${p.name}: ${formatMoney(gameResult.playerResults[p.id] || 0)}`)
          .join('\n');
        
        gameBreakdown += `\n${game.name} ($${game.unitStake}/unit):\n${playerLines}`;
      });
    }

    const text = `🏌️ ${currentRound.course.name} - ${roundDate}\n\n${results}\n\nMoney Shot by F&Gs All Day${gameBreakdown}`;

    if (navigator.share) {
      await navigator.share({ title: 'Golf Round Results', text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Results copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand-dark text-primary-foreground p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-2 text-brand-gold" />
        <h1 className="text-2xl font-bold">Round Complete</h1>
        <p className="text-sm opacity-80">{currentRound.course.name}</p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Leaderboard</h2>
            <span className="text-xs text-muted-foreground">Tap amount to adjust</span>
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
                    onClick={() => handleStartEdit(player.id)}
                    className={`flex items-center gap-2 text-xl font-bold font-mono ${
                      amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {formatMoney(amount)}
                    <Edit2 className="w-4 h-4 opacity-50" />
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

      <div className="p-4 bg-card border-t border-border space-y-3">
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="outline" onClick={() => navigate('/scorecard')} className="flex-1">
            View Scorecard
          </Button>
        </div>
        <Button onClick={handleFinish} className="w-full">
          <Home className="w-4 h-4 mr-2" /> Finish & Save
        </Button>
      </div>
    </div>
  );
};

export default RoundSummary;
