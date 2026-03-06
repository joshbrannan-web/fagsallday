import type { FC } from 'react';

interface Props {
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string }>;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  teamTotals: Record<string, number>;
  activeHole?: number;
}

const TournamentMatchTracker: FC<Props> = ({ holeResults, teamMatchup, teams, teamTotals, activeHole }) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;
  const diff = totalA - totalB;

  let statusText = 'All Square';
  if (diff > 0) statusText = `${teamA?.name || 'Team A'} ${diff} UP`;
  else if (diff < 0) statusText = `${teamB?.name || 'Team B'} ${Math.abs(diff)} UP`;

  const holesPlayed = Object.keys(holeResults).length;
  const thruText = holesPlayed > 0 ? `Thru ${holesPlayed}` : '';
  const remaining = 18 - holesPlayed;

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <p className="text-lg font-bold text-center">
        {statusText}{thruText && <span className="text-muted-foreground text-sm ml-2">— {thruText}</span>}
      </p>

      {/* 18-dot tracker */}
      <div className="flex justify-center gap-1 flex-wrap">
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const result = holeResults[hole];
          const isCurrent = hole === activeHole;
          let bgColor = 'hsl(var(--muted))'; // unplayed

          if (result) {
            const aPoints = result.teamPoints[teamMatchup.teamAId] || 0;
            const bPoints = result.teamPoints[teamMatchup.teamBId] || 0;
            if (aPoints > bPoints) bgColor = teamA?.color || '#3b82f6';
            else if (bPoints > aPoints) bgColor = teamB?.color || '#ef4444';
            else bgColor = '#9ca3af'; // halved = gray
          }

          return (
            <div
              key={hole}
              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold ${
                isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''
              }`}
              style={{ backgroundColor: bgColor, color: result ? '#fff' : 'hsl(var(--muted-foreground))' }}
              title={`Hole ${hole}`}
            >
              {hole}
            </div>
          );
        })}
      </div>

      {/* Points summary */}
      <div className="flex justify-center gap-6 text-sm">
        {teamA && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA.color }} />
            <span className="font-semibold">{teamA.name}: {totalA} pts</span>
          </span>
        )}
        {teamB && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB.color }} />
            <span className="font-semibold">{teamB.name}: {totalB} pts</span>
          </span>
        )}
      </div>

      {remaining > 0 && (
        <p className="text-xs text-center text-muted-foreground">{remaining * 1} pts remaining</p>
      )}
    </div>
  );
};

export default TournamentMatchTracker;
