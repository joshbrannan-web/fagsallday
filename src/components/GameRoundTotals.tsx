import React from 'react';
import { Player } from '../types';

interface GameRoundTotalsProps {
  gameName: string;
  playerResults: { [playerId: string]: number };
  players: Player[];
  icon?: React.ReactNode;
  accentColor?: 'primary' | 'amber' | 'brand-gold' | 'destructive';
}

const GameRoundTotals: React.FC<GameRoundTotalsProps> = ({
  gameName,
  playerResults,
  players,
  icon,
  accentColor = 'primary'
}) => {
  // Skip if no financial activity
  const hasActivity = Object.values(playerResults).some(v => v !== 0);
  if (!hasActivity) return null;

  const colorClasses = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/30' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    'brand-gold': { bg: 'bg-brand-gold/10', border: 'border-brand-gold/30' },
    destructive: { bg: 'bg-destructive/10', border: 'border-destructive/30' }
  };

  const colors = colorClasses[accentColor];

  return (
    <div className={`mt-4 bg-card rounded-xl shadow-sm border ${colors.border} overflow-hidden`}>
      <div className={`${colors.bg} px-4 py-3 border-b ${colors.border}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-sm text-foreground">{gameName} Round Totals</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {players.slice(0, 4).map(player => {
            const total = playerResults[player.id] || playerResults[String(player.id)] || 0;
            return (
              <div 
                key={player.id}
                className={`flex flex-col items-center p-2 rounded-lg ${
                  total > 0 ? 'bg-success/10 border border-success/20' :
                  total < 0 ? 'bg-destructive/10 border border-destructive/20' :
                  'bg-muted/50'
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground truncate max-w-full">
                  {player.name}
                </span>
                <span className={`font-mono font-bold ${
                  total > 0 ? 'text-success' : 
                  total < 0 ? 'text-destructive' : 
                  'text-muted-foreground'
                }`}>
                  {total > 0 ? `+$${total}` : total < 0 ? `-$${Math.abs(total)}` : '$0'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameRoundTotals;
