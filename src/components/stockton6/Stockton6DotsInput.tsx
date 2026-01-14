import React from 'react';
import { Player, DotType } from '@/types';
import { Bird, Circle, Flag, Droplet } from 'lucide-react';

interface Stockton6DotsInputProps {
  players: Player[];
  hole: number;
  dotsData: { [playerId: string]: DotType[] };
  onToggleDot: (playerId: string, dotType: DotType) => void;
  teamA: string[];
  teamB: string[];
}

const DOT_CONFIG: { type: DotType; icon: React.ReactNode; label: string; shortLabel: string; color: string }[] = [
  { type: 'BIRDIE', icon: <Bird className="w-4 h-4" />, label: 'Birdie', shortLabel: '🐦', color: 'bg-yellow-500' },
  { type: 'GREENIE', icon: <Circle className="w-4 h-4" />, label: 'Greenie', shortLabel: '🟢', color: 'bg-green-500' },
  { type: 'SANDIE', icon: <Flag className="w-4 h-4" />, label: 'Sandie', shortLabel: '⛳', color: 'bg-amber-600' },
  { type: 'WATERY_PAR', icon: <Droplet className="w-4 h-4" />, label: 'Watery Par', shortLabel: '💧', color: 'bg-blue-500' },
];

const Stockton6DotsInput: React.FC<Stockton6DotsInputProps> = ({
  players,
  hole,
  dotsData,
  onToggleDot,
  teamA,
  teamB
}) => {
  const getPlayerTeam = (playerId: string): 'A' | 'B' | null => {
    if (teamA.includes(playerId)) return 'A';
    if (teamB.includes(playerId)) return 'B';
    return null;
  };

  const getPlayerDots = (playerId: string): DotType[] => {
    return dotsData[playerId] || [];
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="text-lg">🎯</span> Dots
        </h3>
        <div className="flex gap-1">
          {DOT_CONFIG.map(dot => (
            <span key={dot.type} className="text-xs" title={dot.label}>
              {dot.shortLabel}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {players.map(player => {
          const team = getPlayerTeam(player.id);
          const playerDots = getPlayerDots(player.id);
          
          return (
            <div 
              key={player.id}
              className={`flex items-center gap-2 p-2 rounded-lg ${
                team === 'A' ? 'bg-primary/10' : 'bg-destructive/10'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${team === 'A' ? 'bg-primary' : 'bg-destructive'}`} />
                  <span className="text-sm font-medium text-foreground truncate">
                    {player.name.split(' ')[0]}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-1">
                {DOT_CONFIG.map(dot => {
                  const isActive = playerDots.includes(dot.type);
                  return (
                    <button
                      key={dot.type}
                      onClick={() => onToggleDot(player.id, dot.type)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        isActive 
                          ? `${dot.color} text-white shadow-md scale-110` 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      title={dot.label}
                    >
                      {dot.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot totals */}
      <div className="flex justify-between mt-3 pt-2 border-t border-border text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Team A:</span>
          <span className="font-bold text-foreground">
            {teamA.reduce((sum, pid) => sum + (dotsData[pid]?.length || 0), 0)} dots
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Team B:</span>
          <span className="font-bold text-foreground">
            {teamB.reduce((sum, pid) => sum + (dotsData[pid]?.length || 0), 0)} dots
          </span>
        </div>
      </div>
    </div>
  );
};

export default Stockton6DotsInput;
