import React from 'react';
import { Flame } from 'lucide-react';
import { Round, GameSettings } from '@/types';
import { calculateBallState, getStretchForHole, getHoleInStretch, getTeamAssignment } from '@/services/stockton6Engine';

interface Stockton6StatusBarProps {
  round: Round;
  game: GameSettings;
  currentHole: number;
}

const Stockton6StatusBar: React.FC<Stockton6StatusBarProps> = ({
  round,
  game,
  currentHole
}) => {
  const stretch = getStretchForHole(currentHole);
  const holeInStretch = getHoleInStretch(currentHole);
  const teamAssignment = getTeamAssignment(round.gameData, game.id, stretch);
  
  if (!teamAssignment) return null;
  
  const ballState = calculateBallState(round, game.id, stretch, currentHole);
  if (!ballState) return null;
  
  const { oneBall, twoBall } = ballState;
  
  const formatUp = (up: number): string => {
    if (up === 0) return 'AS';
    return up > 0 ? `A+${up}` : `B+${Math.abs(up)}`;
  };
  
  const getUpColor = (up: number): string => {
    if (up === 0) return 'text-muted-foreground';
    return up > 0 ? 'text-primary' : 'text-destructive';
  };

  const PressIndicator = ({ count }: { count: number }) => {
    if (count === 0) return null;
    
    return (
      <div className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
        ${count >= 3 ? 'bg-red-500/20 animate-pulse' : 
          count >= 2 ? 'bg-orange-500/20' : 'bg-amber-500/20'}
        transition-all duration-300
      `}>
        <Flame 
          className={`w-3 h-3 ${count >= 3 ? 'text-red-500' : 
            count >= 2 ? 'text-orange-500' : 'text-amber-500'}`}
          fill={count >= 2 ? 'currentColor' : 'none'}
        />
        <span className={`text-xs font-bold ${count >= 3 ? 'text-red-500' : 
          count >= 2 ? 'text-orange-500' : 'text-amber-500'}`}>
          PRESS{count > 1 ? ` x${count}` : ''}
        </span>
      </div>
    );
  };

  const SideStatus = ({ label, up, presses }: { label: string; up: number; presses: { teamAUp: number }[] }) => (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className={`text-xs font-bold ${getUpColor(up)}`}>{formatUp(up)}</span>
      <PressIndicator count={presses.length} />
    </div>
  );

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">6️⃣</span>
          <span className="text-xs font-bold text-muted-foreground uppercase">
            Stretch {stretch} • Hole {holeInStretch}/6
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          ${teamAssignment.unitValue}/unit
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* 1-Ball */}
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-xs font-bold text-foreground mb-1">1-Ball</div>
          <div className="space-y-0.5">
            <SideStatus label="F" up={oneBall.front.teamAUp} presses={oneBall.front.presses} />
            <SideStatus label="B" up={oneBall.back.teamAUp} presses={oneBall.back.presses} />
            <div className="flex items-center gap-1 pt-0.5 border-t border-border">
              <span className="text-xs text-muted-foreground">O:</span>
              <span className={`text-xs font-bold ${getUpColor(oneBall.overall.teamAUp)}`}>
                {formatUp(oneBall.overall.teamAUp)}
              </span>
            </div>
          </div>
        </div>
        
        {/* 2-Ball */}
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-xs font-bold text-foreground mb-1">2-Ball</div>
          <div className="space-y-0.5">
            <SideStatus label="F" up={twoBall.front.teamAUp} presses={twoBall.front.presses} />
            <SideStatus label="B" up={twoBall.back.teamAUp} presses={twoBall.back.presses} />
            <div className="flex items-center gap-1 pt-0.5 border-t border-border">
              <span className="text-xs text-muted-foreground">O:</span>
              <span className={`text-xs font-bold ${getUpColor(twoBall.overall.teamAUp)}`}>
                {formatUp(twoBall.overall.teamAUp)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Team indicator */}
      <div className="flex justify-between mt-2 pt-2 border-t border-border text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          <span className="text-muted-foreground">Team A:</span>
          <span className="font-medium text-foreground">
            {teamAssignment.teamA.map(id => round.players.find(p => p.id === id)?.name.split(' ')[0]).join(', ')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-destructive"></div>
          <span className="text-muted-foreground">Team B:</span>
          <span className="font-medium text-foreground">
            {teamAssignment.teamB.map(id => round.players.find(p => p.id === id)?.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Stockton6StatusBar;
