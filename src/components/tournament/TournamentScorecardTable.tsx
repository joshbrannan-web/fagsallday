import type { FC } from 'react';
import type { TournamentPlayer } from '@/types/tournament';
import type { CourseHole } from '@/services/tournamentEngine';
import type { MatchState } from '@/types/tournament';

interface Props {
  tournamentPlayers: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string; grossScores?: Record<string, number>; netScores?: Record<string, number>; pointsValue?: number }>;
  courseHoles: CourseHole[];
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teamTotals: Record<string, number>;
  viewMode: 'FRONT' | 'BACK';
  matchState?: MatchState;
}

const TournamentScorecardTable: FC<Props> = ({
  tournamentPlayers,
  teamAssignments,
  teams,
  holeResults,
  courseHoles,
  teamMatchup,
  teamTotals,
  viewMode,
  matchState,
}) => {
  if (!teamMatchup) return null;

  const front9 = courseHoles.filter(h => h.number <= 9);
  const back9 = courseHoles.filter(h => h.number > 9);
  const activeHoles = viewMode === 'FRONT' ? front9 : back9;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;
  const diff = totalA - totalB;

  // Match status text
  let statusText = 'All Square';
  if (matchState?.isComplete) {
    statusText = matchState.resultLabel || 'Complete';
  } else if (diff > 0) {
    statusText = `${teamA?.name || 'Team A'} ${diff} UP`;
  } else if (diff < 0) {
    statusText = `${teamB?.name || 'Team B'} ${Math.abs(diff)} UP`;
  }

  const holesPlayed = Object.values(holeResults).filter(hr => hr.resultLabel && hr.resultLabel !== '').length;

  // Sort players by team
  const sortedPlayers = [...tournamentPlayers].sort((a, b) => {
    const tA = teamAssignments[a.id] || '';
    const tB = teamAssignments[b.id] || '';
    if (tA === teamMatchup.teamAId && tB !== teamMatchup.teamAId) return -1;
    if (tA !== teamMatchup.teamAId && tB === teamMatchup.teamAId) return 1;
    return 0;
  });

  const getPlayerSubtotal = (playerId: string) => {
    let total = 0;
    activeHoles.forEach(h => {
      const score = holeResults[h.number]?.grossScores?.[playerId];
      if (typeof score === 'number') total += score;
    });
    return total || null;
  };

  const getPlayerTotal = (playerId: string) => {
    let total = 0;
    courseHoles.forEach(h => {
      const score = holeResults[h.number]?.grossScores?.[playerId];
      if (typeof score === 'number') total += score;
    });
    return total || null;
  };

  // Get 9-hole team points subtotal
  const getTeamSubtotal = (teamId: string) => {
    let total = 0;
    activeHoles.forEach(h => {
      const pts = holeResults[h.number]?.teamPoints?.[teamId];
      if (typeof pts === 'number') total += pts;
    });
    return total;
  };

  return (
    <div className="space-y-3">
      {/* Status */}
      <p className="text-base font-bold text-center">
        {statusText}
        {holesPlayed > 0 && !matchState?.isComplete && (
          <span className="text-muted-foreground text-sm ml-2">— Thru {holesPlayed}</span>
        )}
      </p>

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-center border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
              <th className="p-2 text-left min-w-[90px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
              {activeHoles.map(h => (
                <th key={h.number} className="p-1.5 min-w-[36px] border-r border-border/50">
                  {h.number}
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}</div>
                </th>
              ))}
              <th className="p-1.5 min-w-[40px] bg-muted">{viewMode === 'FRONT' ? 'F9' : 'B9'}</th>
              <th className="p-1.5 min-w-[40px] bg-muted border-l border-border">18</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => {
              const teamId = teamAssignments[player.id];
              const team = teams[teamId];
              const subtotal = getPlayerSubtotal(player.id);
              const total = getPlayerTotal(player.id);

              return (
                <tr key={player.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                  <td className="p-2 text-left sticky left-0 bg-inherit border-r border-border z-10">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team?.color || 'hsl(var(--muted))' }}
                      />
                      <span className="font-semibold text-xs truncate max-w-[70px]">{player.displayName}</span>
                    </div>
                  </td>
                  {activeHoles.map(h => {
                    const score = holeResults[h.number]?.grossScores?.[player.id];
                    const hasScore = typeof score === 'number';
                    const d = hasScore ? score - h.par : 0;
                    const isUnderPar = d < 0;
                    const isOverPar = d > 0;
                    const isDblPlus = d >= 2;
                    const shapeClass = isUnderPar ? 'rounded-full' : isOverPar ? 'rounded-lg' : '';

                    return (
                      <td key={h.number} className="p-1 border-r border-border/50">
                        {hasScore ? (
                          <span className={`inline-block w-7 h-7 leading-7 ${shapeClass} text-xs font-bold ${
                            d <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
                            d === -1 ? 'bg-success/20 text-success' :
                            d === 0 ? '' :
                            isDblPlus ? 'border-2 border-foreground ring-2 ring-foreground ring-offset-1 text-destructive' :
                            d === 1 ? 'border-2 border-foreground text-destructive' : ''
                          }`}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-1 font-bold text-xs">{subtotal || '-'}</td>
                  <td className="p-1 font-bold text-xs border-l border-border">{total || '-'}</td>
                </tr>
              );
            })}

            {/* Result row */}
            <tr className="bg-amber-50/60 dark:bg-amber-950/20 border-t border-amber-400/40">
              <td className="p-2 text-left text-xs font-semibold text-amber-800 dark:text-amber-300 sticky left-0 bg-inherit border-r border-border z-10">
                Result
              </td>
              {activeHoles.map(h => {
                const result = holeResults[h.number];
                if (!result || !result.resultLabel) {
                  return <td key={h.number} className="p-1 border-r border-border/50 text-muted-foreground text-xs">—</td>;
                }

                const aPoints = result.teamPoints[teamMatchup.teamAId] || 0;
                const bPoints = result.teamPoints[teamMatchup.teamBId] || 0;

                if (aPoints === bPoints) {
                  return (
                    <td key={h.number} className="p-1 border-r border-border/50">
                      <span className="text-xs font-bold text-muted-foreground">½</span>
                    </td>
                  );
                }

                const winnerTeamId = aPoints > bPoints ? teamMatchup.teamAId : teamMatchup.teamBId;
                const winnerTeam = teams[winnerTeamId];

                return (
                  <td key={h.number} className="p-1 border-r border-border/50">
                    <span
                      className="inline-block w-4 h-4 rounded-full"
                      style={{ backgroundColor: winnerTeam?.color || '#9ca3af' }}
                    />
                  </td>
                );
              })}
              <td className="p-1 text-xs font-bold">
                {/* 9-hole points subtotals */}
              </td>
              <td className="p-1 text-xs font-bold border-l border-border" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Team totals */}
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
    </div>
  );
};

export default TournamentScorecardTable;
