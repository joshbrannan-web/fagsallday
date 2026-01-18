import React, { useState } from 'react';
import { useAdminRound } from '@/contexts/AdminRoundContext';
import { ChevronLeft, ChevronRight, Crown, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { calculateAggregatedHolePnL } from '../services/gameEngine';
import { calculateRelativeStrokes } from '../services/stockton6Engine';
import { GameType } from '../types';

const AdminActiveRound: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useAdminRound();
  const [activeHole, setActiveHole] = useState(1);

  if (!currentRound) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Round Data</h2>
        <Button onClick={() => navigate('/admin')}>
          <Home className="w-5 h-5 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const courseHole = currentRound.course.holes.find(h => h.number === activeHole);
  const holePnL = calculateAggregatedHolePnL(currentRound);
  const bankerGame = currentRound.games.find(g => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER);
  const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);

  const getBankerForHole = (holeNum: number): string | null => {
    if (!bankerGame) return null;
    const holeData = currentRound.gameData?.[bankerGame.id]?.[holeNum];
    return holeData?._META_BANKER_ID || holeData?.bankerId || null;
  };

  const bankerId = getBankerForHole(activeHole);

  return (
    <div className="flex flex-col">
      {/* Hole Navigation */}
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-lg">
        <div className="flex flex-col items-center text-center mb-4">
          <h1 className="text-2xl font-bold">Hole {activeHole}</h1>
          <div className="flex gap-3 text-xs text-muted-foreground font-mono tracking-wider">
            <span>PAR {courseHole?.par}</span>
            <span className="opacity-50">|</span>
            <span>{courseHole?.yardage} YDS</span>
            <span className="opacity-50">|</span>
            <span>IDX {courseHole?.handicapIndex}</span>
          </div>
        </div>
        <div className="flex justify-between items-center gap-4">
          <button 
            disabled={activeHole === 1}
            onClick={() => setActiveHole(h => h - 1)}
            className="bg-primary p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {currentRound.course.holes.map(h => (
              <button
                key={h.number}
                onClick={() => setActiveHole(h.number)}
                className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                  activeHole === h.number 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {h.number}
              </button>
            ))}
          </div>
          <button 
            disabled={activeHole === 18}
            onClick={() => setActiveHole(h => h + 1)}
            className="bg-primary p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Banker Info */}
      {bankerGame && (
        <div className="p-4 border-b border-border">
          <div className="bg-card rounded-xl p-4 border border-brand-gold/30">
            <h3 className="font-bold text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-brand-gold" /> Banker
            </h3>
            {bankerId ? (
              <div className="flex items-center gap-2">
                <div className="bg-brand-gold text-brand-dark px-3 py-1 rounded-lg font-bold">
                  {currentRound.players.find(p => p.id === bankerId)?.name || 'Unknown'}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No banker selected</p>
            )}
          </div>
        </div>
      )}

      {/* Player Scores */}
      <div className="p-4 space-y-3">
        <h3 className="font-bold text-sm text-muted-foreground">Player Scores</h3>
        {currentRound.players.map(player => {
          const score = currentRound.scores[activeHole]?.[player.id];
          const playerPnL = holePnL[activeHole]?.[player.id] || 0;
          const isBanker = bankerId === player.id;
          
          // Check for strokes
          let hasStroke = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[player.id] === 1;
          if (!hasStroke && stockton6Game) {
            const autoStrokes = calculateRelativeStrokes(currentRound.players, courseHole?.handicapIndex || 0);
            hasStroke = autoStrokes[player.id] === 1;
          }

          return (
            <div 
              key={player.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                isBanker ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                {isBanker && <Crown className="w-5 h-5 text-brand-gold" />}
                <div>
                  <span className="font-semibold">{player.name}</span>
                  {hasStroke && (
                    <span className="ml-2 inline-block w-4 h-4 bg-primary rounded-full text-primary-foreground text-[10px] leading-4 text-center font-bold">
                      •
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-mono ${
                  playerPnL > 0 ? 'text-success' : playerPnL < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {playerPnL !== 0 ? (playerPnL > 0 ? `+$${playerPnL}` : `-$${Math.abs(playerPnL)}`) : '$0'}
                </span>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                  score !== undefined && score !== null
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {score ?? '-'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Round Totals */}
      <div className="p-4 border-t border-border mt-auto">
        <h3 className="font-bold text-sm text-muted-foreground mb-3">Round Totals</h3>
        <div className="grid grid-cols-2 gap-2">
          {currentRound.players.map(player => (
            <div key={player.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
              <span className="text-sm font-medium truncate">{player.name}</span>
              <span className={`font-mono font-bold ${
                (roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                ${roundTotals[player.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminActiveRound;
