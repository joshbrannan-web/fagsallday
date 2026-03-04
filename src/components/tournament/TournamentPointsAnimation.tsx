import React from 'react';
import type { NewHoleEvent } from '@/hooks/useTournamentOverlay';

interface Props {
  event: NewHoleEvent | null;
  teams: Record<string, { name: string; color: string }>;
}

const TournamentPointsAnimation: React.FC<Props> = ({ event, teams }) => {
  if (!event) return null;

  const winnerTeam = event.winnerTeamId ? teams[event.winnerTeamId] : null;
  const isHalved = !event.winnerTeamId || Object.values(event.teamPoints).every((v, _, arr) => v === arr[0]);
  const maxPts = Math.max(...Object.values(event.teamPoints));

  return (
    <div
      className={`rounded-lg px-4 py-2 text-center text-sm font-semibold transition-all duration-300 animate-in slide-in-from-top-2 ${
        isHalved ? 'bg-muted/40 text-muted-foreground' : 'border'
      }`}
      style={
        !isHalved && winnerTeam
          ? {
              backgroundColor: `${winnerTeam.color}20`,
              borderColor: `${winnerTeam.color}60`,
              color: winnerTeam.color,
            }
          : undefined
      }
    >
      {isHalved ? (
        maxPts > 0
          ? `Hole ${event.holeNumber} halved — ½ pt each`
          : `Hole ${event.holeNumber} — No points`
      ) : (
        <>
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: winnerTeam?.color }} />
          {winnerTeam?.name} wins hole {event.holeNumber} +{maxPts}pt
        </>
      )}
    </div>
  );
};

export default TournamentPointsAnimation;
