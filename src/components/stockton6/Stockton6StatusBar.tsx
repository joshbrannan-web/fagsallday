import React from 'react';
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

  const PressColumns = ({ presses }: { presses: { teamAUp: number }[] }) => {
    if (presses.length === 0) return null;
    
    // Max 2 presses per side
    const displayPresses = presses.slice(0, 2);
    
    return (
      <div className="flex gap-2">
        {displayPresses.map((press, idx) => (
          <div key={idx} className="text-center min-w-[36px]">
            <div className="text-[10px] font-bold text-amber-500 uppercase">Press</div>
            <div className={`text-xs font-bold ${getUpColor(press.teamAUp)}`}>
              {formatUp(press.teamAUp)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const SideStatus = ({ label, up, presses }: { label: string; up: number; presses: { teamAUp: number }[] }) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 min-w-[48px]">
        <span className="text-xs text-muted-foreground">{label}:</span>
        <span className={`text-xs font-bold ${getUpColor(up)}`}>{formatUp(up)}</span>
      </div>
      <PressColumns presses={presses} />
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
