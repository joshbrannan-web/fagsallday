import React from 'react';
import { Player, PlayerHoleDots, Course } from '@/types';
import { Bird, Circle, Target, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Stockton6DotsInputProps {
  players: Player[];
  hole: number;
  holePar: number;
  dotsData: { [playerId: string]: PlayerHoleDots };
  onToggleBirdie: (playerId: string) => void;
  onToggleGreenie: (playerId: string) => void;
  onSetDotMultiplier: (playerId: string, multiplier: number | undefined) => void;
  teamA: string[];
  teamB: string[];
  greenieCarryover: number; // Current Greenie value (1 = normal, 2+ = carried)
}

const Stockton6DotsInput: React.FC<Stockton6DotsInputProps> = ({
  players,
  hole,
  holePar,
  dotsData,
  onToggleBirdie,
  onToggleGreenie,
  onSetDotMultiplier,
  teamA,
  teamB,
  greenieCarryover
}) => {
  const getPlayerTeam = (playerId: string): 'A' | 'B' | null => {
    if (teamA.includes(playerId)) return 'A';
    if (teamB.includes(playerId)) return 'B';
    return null;
  };

  const getPlayerDots = (playerId: string): PlayerHoleDots => {
    return dotsData[playerId] || {};
  };

  const isPar3 = holePar === 3;

  // Count team dots for totals
  const countTeamDots = (teamPlayerIds: string[]): number => {
    return teamPlayerIds.reduce((sum, pid) => {
      const dots = getPlayerDots(pid);
      let count = 0;
      if (dots.birdie) count += 1;
      if (dots.greenie) count += greenieCarryover; // Greenie worth carryover value
      if (dots.dotMultiplier) count += dots.dotMultiplier;
      return sum + count;
    }, 0);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="text-lg">🎯</span> Dots
        </h3>
        <div className="flex items-center gap-2">
          {isPar3 && greenieCarryover > 1 && (
            <span className="text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
              Greenie {greenieCarryover}x!
            </span>
          )}
          <div className="flex gap-1 text-xs">
            <span title="Birdie">🐦</span>
            {isPar3 && <span title="Greenie">⛳️</span>}
            <span title="Dot">🎯</span>
          </div>
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
                {/* Birdie Button */}
                <button
                  onClick={() => onToggleBirdie(player.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                    playerDots.birdie 
                      ? 'bg-yellow-500 text-white shadow-md scale-110' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title="Birdie"
                >
                  🐦
                </button>

                {/* Greenie Button - Only on Par 3 */}
                {isPar3 ? (
                  <button
                    onClick={() => onToggleGreenie(player.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all relative ${
                      playerDots.greenie 
                        ? 'bg-green-500 text-white shadow-md scale-110' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    title={`Greenie (worth ${greenieCarryover} dot${greenieCarryover > 1 ? 's' : ''})`}
                  >
                    ⛳️
                    {greenieCarryover > 1 && playerDots.greenie && (
                      <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-green-700 text-white w-4 h-4 rounded-full flex items-center justify-center">
                        {greenieCarryover}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="w-8 h-8" /> /* Placeholder for alignment */
                )}

                {/* Dot with Multiplier Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`w-10 h-8 rounded-lg flex items-center justify-center text-sm transition-all gap-0.5 ${
                        playerDots.dotMultiplier 
                          ? 'bg-amber-500 text-white shadow-md' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      title="Dot with multiplier"
                    >
                      🎯
                      {playerDots.dotMultiplier ? (
                        <span className="text-[10px] font-bold">{playerDots.dotMultiplier}x</span>
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[80px]">
                    <DropdownMenuItem 
                      onClick={() => onSetDotMultiplier(player.id, undefined)}
                      className={!playerDots.dotMultiplier ? 'bg-muted' : ''}
                    >
                      None
                    </DropdownMenuItem>
                    {[1, 2, 3, 4, 5].map(mult => (
                      <DropdownMenuItem 
                        key={mult}
                        onClick={() => onSetDotMultiplier(player.id, mult)}
                        className={playerDots.dotMultiplier === mult ? 'bg-amber-500/20' : ''}
                      >
                        {mult}x Dot
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
            {countTeamDots(teamA)} dots
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Team B:</span>
          <span className="font-bold text-foreground">
            {countTeamDots(teamB)} dots
          </span>
        </div>
      </div>
    </div>
  );
};

export default Stockton6DotsInput;
