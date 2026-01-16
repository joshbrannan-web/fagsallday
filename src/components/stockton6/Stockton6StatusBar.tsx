import React from 'react';
import { Round, GameSettings, Stockton6BallState } from '@/types';
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

  const BallSection = ({ 
    label, 
    ballState 
  }: { 
    label: string; 
    ballState: Stockton6BallState;
  }) => {
    // Combine all active presses (front + back) into a single array
    const allPresses = [
      ...ballState.front.presses.slice(0, 2),
      ...ballState.back.presses.slice(0, 2)
    ];
    
    return (
      <div className="bg-muted/50 rounded-lg p-2">
        {/* Header row: Ball label + Press headers */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-bold text-foreground min-w-[44px]">{label}</span>
          {allPresses.map((_, idx) => (
            <span key={idx} className="text-[10px] font-bold text-amber-500 min-w-[32px] text-center uppercase">
              Press
            </span>
          ))}
        </div>
        
        {/* F row: Front status + ALL press values */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 min-w-[44px]">
            <span className="text-xs text-muted-foreground">F:</span>
            <span className={`text-xs font-bold ${getUpColor(ballState.front.teamAUp)}`}>
              {formatUp(ballState.front.teamAUp)}
            </span>
          </div>
          {allPresses.map((press, idx) => (
            <span key={idx} className={`text-xs font-bold min-w-[32px] text-center ${getUpColor(press.teamAUp)}`}>
              {formatUp(press.teamAUp)}
            </span>
          ))}
        </div>
        
        {/* B row: Back status only */}
        <div className="flex items-center">
          <div className="flex items-center gap-1 min-w-[44px]">
            <span className="text-xs text-muted-foreground">B:</span>
            <span className={`text-xs font-bold ${getUpColor(ballState.back.teamAUp)}`}>
              {formatUp(ballState.back.teamAUp)}
            </span>
          </div>
        </div>
        
        {/* O row: Overall status only */}
        <div className="flex items-center pt-0.5 border-t border-border">
          <div className="flex items-center gap-1 min-w-[44px]">
            <span className="text-xs text-muted-foreground">O:</span>
            <span className={`text-xs font-bold ${getUpColor(ballState.overall.teamAUp)}`}>
              {formatUp(ballState.overall.teamAUp)}
            </span>
          </div>
        </div>
      </div>
    );
  };

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
        <BallSection label="1-Ball" ballState={oneBall} />
        <BallSection label="2-Ball" ballState={twoBall} />
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
