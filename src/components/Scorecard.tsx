import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { ArrowLeft, Home, Play } from 'lucide-react';
import { calculateAggregatedHolePnL } from '../services/gameEngine';
import { Button } from '@/components/ui/button';

const Scorecard: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useApp();
  const [viewMode, setViewMode] = useState<'FRONT' | 'BACK'>('FRONT');

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

  const holePnL = calculateAggregatedHolePnL(currentRound);
  const holes = currentRound.course.holes;
  const front9 = holes.filter(h => h.number <= 9);
  const back9 = holes.filter(h => h.number > 9);
  const activeHoles = viewMode === 'FRONT' ? front9 : back9;

  const getPlayerScore = (pid: string, holeNum: number) => {
    const score = currentRound.scores[holeNum]?.[pid];
    return typeof score === 'number' ? score : '-';
  };

  const getPlayerHoleMoney = (pid: string, holeNum: number) => {
    return holePnL[holeNum]?.[pid] || 0;
  };

  const calculateSubtotalScore = (pid: string, holesToSum: typeof activeHoles) => {
    let total = 0;
    holesToSum.forEach(h => {
      const s = currentRound.scores[h.number]?.[pid];
      if (typeof s === 'number') total += s;
    });
    return total;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Scorecard</h1>
        <div className="w-10" />
      </div>

      <div className="p-4 flex justify-center">
        <div className="bg-card p-1 rounded-xl shadow-sm border border-border flex gap-1">
          <button
            onClick={() => setViewMode('FRONT')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'FRONT' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Front 9
          </button>
          <button
            onClick={() => setViewMode('BACK')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'BACK' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Back 9
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="inline-block min-w-full bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <thead>
              <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
                {activeHoles.map(h => (
                  <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                    {h.number}
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}</div>
                  </th>
                ))}
                <th className="p-2 min-w-[50px] bg-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {currentRound.players.map((player, idx) => (
                <React.Fragment key={player.id}>
                  <tr className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                    <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                      {player.name}
                    </td>
                    {activeHoles.map(h => {
                      const score = getPlayerScore(player.id, h.number);
                      const diff = typeof score === 'number' ? score - h.par : 0;
                      return (
                        <td key={h.number} className="p-2 border-r border-border/50">
                          <span className={`inline-block w-8 h-8 leading-8 rounded-full text-sm font-bold ${
                            diff <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
                            diff === -1 ? 'bg-success/20 text-success' :
                            diff === 0 ? '' :
                            diff === 1 ? 'bg-destructive/10 text-destructive' :
                            'bg-destructive/20 text-destructive'
                          }`}>
                            {score}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 font-bold">{calculateSubtotalScore(player.id, activeHoles) || '-'}</td>
                  </tr>
                  <tr className={`text-xs ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">P&L</td>
                    {activeHoles.map(h => {
                      const money = getPlayerHoleMoney(player.id, h.number);
                      return (
                        <td key={h.number} className="px-2 pb-2 border-r border-border/50">
                          <span className={`font-mono ${money > 0 ? 'text-success' : money < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {money !== 0 ? (money > 0 ? `+${money}` : money) : '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 pb-2">
                      <span className={`font-mono font-bold ${(roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        ${roundTotals[player.id] || 0}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-card border-t border-border">
        <Button onClick={() => navigate('/active')} className="w-full">
          <Play className="w-4 h-4 mr-2" /> Return to Hole
        </Button>
      </div>
    </div>
  );
};

export default Scorecard;
