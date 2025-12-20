import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { GameType } from '../types';
import { getNetScore, calculateStrokesReceived, formatMoney } from '../services/gameEngine';
import { ArrowLeft, ArrowRight, Home, FileText, Minus, Plus, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ActiveRound: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, updateScore, updateGameData, roundTotals } = useApp();
  const [currentHole, setCurrentHole] = useState(1);

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Active Round</h2>
        <Button onClick={() => navigate('/')}>
          <Home className="w-5 h-5 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const hole = currentRound.course.holes.find(h => h.number === currentHole);
  if (!hole) return null;

  const holeScores = currentRound.scores[currentHole] || {};
  const bankerGame = currentRound.games.find(g => g.type === GameType.BANKER);
  const bankerData = bankerGame ? currentRound.gameData?.[bankerGame.id]?.[currentHole] : null;

  const handleScoreChange = (playerId: string, delta: number) => {
    const current = holeScores[playerId] || hole.par;
    const newScore = Math.max(1, current + delta);
    updateScore(currentHole, playerId, newScore);
  };

  const handleSetBanker = (playerId: string) => {
    if (!bankerGame) return;
    updateGameData(bankerGame.id, currentHole, {
      ...bankerData,
      bankerId: playerId,
      bankerMultiplier: 1,
      playerMultipliers: {}
    });
  };

  const navigateHole = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentHole > 1) {
      setCurrentHole(currentHole - 1);
    } else if (direction === 'next' && currentHole < 18) {
      setCurrentHole(currentHole + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full">
            <Home className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="font-bold">{currentRound.course.name}</h1>
            <p className="text-xs opacity-80">Hole {currentHole} of 18</p>
          </div>
          <button onClick={() => navigate('/scorecard')} className="p-2 hover:bg-white/10 rounded-full">
            <FileText className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hole Info */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateHole('prev')}
            disabled={currentHole === 1}
            className="p-3 rounded-full bg-muted disabled:opacity-30"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{currentHole}</div>
            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
              <span>Par {hole.par}</span>
              <span>{hole.yardage} yds</span>
              <span>HCP {hole.handicapIndex}</span>
            </div>
          </div>

          <button
            onClick={() => navigateHole('next')}
            disabled={currentHole === 18}
            className="p-3 rounded-full bg-muted disabled:opacity-30"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Player Scores */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {currentRound.players.map(player => {
          const gross = holeScores[player.id] || hole.par;
          const strokes = calculateStrokesReceived(player.courseHandicap, hole.handicapIndex);
          const net = getNetScore(gross, hole.par, hole.handicapIndex, player.courseHandicap);
          const isBanker = bankerData?.bankerId === player.id;
          const totalMoney = roundTotals[player.id] || 0;

          return (
            <div
              key={player.id}
              className={`bg-card rounded-xl border-2 p-4 transition-all ${
                isBanker ? 'border-brand-gold shadow-golf' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isBanker && <Crown className="w-5 h-5 text-brand-gold" />}
                  <span className="font-bold">{player.name}</span>
                  {strokes > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      +{strokes} stroke{strokes > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-sm ${totalMoney >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatMoney(totalMoney)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleScoreChange(player.id, -1)}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center active:scale-95"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  
                  <div className="text-center min-w-[60px]">
                    <div className="text-3xl font-bold">{gross}</div>
                    <div className="text-xs text-muted-foreground">Net: {net}</div>
                  </div>

                  <button
                    onClick={() => handleScoreChange(player.id, 1)}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {bankerGame && !isBanker && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetBanker(player.id)}
                  >
                    <Crown className="w-4 h-4 mr-1" />
                    Banker
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 bg-card border-t border-border flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate('/summary')}
          className="flex-1"
        >
          Finish Round
        </Button>
        <Button
          onClick={() => currentHole < 18 && setCurrentHole(currentHole + 1)}
          disabled={currentHole >= 18}
          className="flex-1"
        >
          Next Hole
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default ActiveRound;
