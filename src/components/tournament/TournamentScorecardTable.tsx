import type { FC } from 'react';
import type { TournamentPlayer } from '@/types/tournament';
import type { CourseHole } from '@/services/tournamentEngine';
import type { MatchState } from '@/types/tournament';

interface Props {
  tournamentPlayers: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string; grossScores?: Record<string, number>; netScores?: Record<string, number>; pointsValue?: number; playerPoints?: Record<string, number> }>;
  courseHoles: CourseHole[];
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teamTotals: Record<string, number>;
  viewMode: 'FRONT' | 'BACK';
  matchState?: MatchState;
  subMatchups?: { playerA: string; playerB: string }[];
}

/* ── Score cell styling helper ── */
const scoreCell = (score: number, par: number) => {
  const d = score - par;
  const isUnderPar = d < 0;
  const isOverPar = d > 0;
  const isDblPlus = d >= 2;
  const shapeClass = isUnderPar ? 'rounded-full' : isOverPar ? 'rounded-lg' : '';
  const colorClass =
    d <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
    d === -1 ? 'bg-success/20 text-success' :
    d === 0 ? '' :
    isDblPlus ? 'border-2 border-foreground ring-2 ring-foreground ring-offset-1 text-destructive' :
    d === 1 ? 'border-2 border-foreground text-destructive' : '';
  return { shapeClass, colorClass };
};

/* ── Single matchup table ── */
const MatchupTable: FC<{
  matchLabel: string;
  playerA: TournamentPlayer;
  playerB: TournamentPlayer;
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Props['holeResults'];
  activeHoles: CourseHole[];
  courseHoles: CourseHole[];
  viewMode: 'FRONT' | 'BACK';
}> = ({ matchLabel, playerA, playerB, teamAssignments, teams, holeResults, activeHoles, courseHoles }) => {
  const players = [playerA, playerB];

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

  // Per-player point totals
  let aPts = 0, bPts = 0;
  Object.values(holeResults).forEach(hr => {
    aPts += hr.playerPoints?.[playerA.id] || 0;
    bPts += hr.playerPoints?.[playerB.id] || 0;
  });

  const aName = playerA.displayName.split(' ')[0];
  const bName = playerB.displayName.split(' ')[0];
  let statusText = 'All Square';
  if (aPts > bPts) statusText = `${aName} ${aPts - bPts} UP`;
  else if (bPts > aPts) statusText = `${bName} ${bPts - aPts} UP`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{matchLabel}</span>
        <span className="text-xs font-semibold text-muted-foreground">{statusText}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
              <th className="p-2 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
              {activeHoles.map(h => (
                <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                  {h.number}
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}</div>
                </th>
              ))}
              <th className="p-1.5 min-w-[40px] bg-muted">Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => {
              const teamId = teamAssignments[player.id];
              const team = teams[teamId];

              return (
                <tr key={player.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                  <td className="p-2 text-left sticky left-0 bg-inherit border-r border-border z-10">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team?.color || 'hsl(var(--muted))' }}
                      />
                      <span className="font-semibold text-xs whitespace-normal break-words leading-tight">{player.displayName}</span>
                    </div>
                  </td>
                  {activeHoles.map(h => {
                    const score = holeResults[h.number]?.grossScores?.[player.id];
                    const hasScore = typeof score === 'number';
                    if (!hasScore) {
                      return <td key={h.number} className="p-1.5 border-r border-border/50"><span className="text-muted-foreground text-xs">-</span></td>;
                    }
                    const { shapeClass, colorClass } = scoreCell(score, h.par);
                    return (
                      <td key={h.number} className="p-1.5 border-r border-border/50">
                        <span className={`inline-block w-7 h-7 leading-7 ${shapeClass} text-xs font-bold ${colorClass}`}>
                          {score}
                        </span>
                      </td>
                    );
                  })}
                  <td className="p-1 font-bold text-xs">
                    {player.id === playerA.id ? aPts : bPts}
                  </td>
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
                if (!result || !result.playerPoints) {
                  return <td key={h.number} className="p-1.5 border-r border-border/50 text-muted-foreground text-xs">—</td>;
                }

                const ppA = result.playerPoints[playerA.id] || 0;
                const ppB = result.playerPoints[playerB.id] || 0;

                if (ppA === 0 && ppB === 0) {
                  return <td key={h.number} className="p-1.5 border-r border-border/50 text-muted-foreground text-xs">—</td>;
                }

                if (ppA === ppB) {
                  return (
                    <td key={h.number} className="p-1 border-r border-border/50">
                      <span className="text-xs font-bold text-muted-foreground">½</span>
                    </td>
                  );
                }

                const winnerId = ppA > ppB ? playerA.id : playerB.id;
                const winnerTeamId = teamAssignments[winnerId];
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
              <td className="p-1 text-xs font-bold" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-match point totals */}
      <div className="flex justify-center gap-6 text-sm">
        {[playerA, playerB].map(p => {
          const tid = teamAssignments[p.id];
          const team = teams[tid];
          const pts = p.id === playerA.id ? aPts : bPts;
          return (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team?.color }} />
              <span className="font-semibold">{p.displayName.split(' ')[0]}: {pts} pts</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ── Main component ── */
const TournamentScorecardTable: FC<Props> = ({
  tournamentPlayers, teamAssignments, teams, holeResults, courseHoles,
  teamMatchup, teamTotals, viewMode, matchState, subMatchups,
}) => {
  if (!teamMatchup) return null;

  const front9 = courseHoles.filter(h => h.number <= 9);
  const back9 = courseHoles.filter(h => h.number > 9);
  const activeHoles = viewMode === 'FRONT' ? front9 : back9;

  const has1v1 = subMatchups && subMatchups.length > 0;

  // 1v1: render separate tables per matchup
  if (has1v1) {
    const playerMap = Object.fromEntries(tournamentPlayers.map(p => [p.id, p]));
    const normalizeMatchup = (sm: { playerA: string; playerB: string }) =>
      teamAssignments[sm.playerA] === teamMatchup.teamAId ? sm : { playerA: sm.playerB, playerB: sm.playerA };

    return (
      <div className="space-y-6">
        {subMatchups!.map((rawSm, idx) => {
          const sm = normalizeMatchup(rawSm);
          const pA = playerMap[sm.playerA];
          const pB = playerMap[sm.playerB];
          if (!pA || !pB) return null;

          return (
            <MatchupTable
              key={idx}
              matchLabel={`Match ${idx + 1}`}
              playerA={pA}
              playerB={pB}
              teamAssignments={teamAssignments}
              teams={teams}
              holeResults={holeResults}
              activeHoles={activeHoles}
              courseHoles={courseHoles}
              viewMode={viewMode}
            />
          );
        })}
      </div>
    );
  }

  // Default combined team view
  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;
  const diff = totalA - totalB;

  let statusText = 'All Square';
  if (matchState?.isComplete) {
    statusText = matchState.resultLabel || 'Complete';
  } else if (diff > 0) {
    statusText = `${teamA?.name || 'Team A'} ${diff} UP`;
  } else if (diff < 0) {
    statusText = `${teamB?.name || 'Team B'} ${Math.abs(diff)} UP`;
  }

  const holesPlayed = Object.values(holeResults).filter(hr => hr.resultLabel && hr.resultLabel !== '').length;

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
      <p className="text-base font-bold text-center">
        {statusText}
        {holesPlayed > 0 && !matchState?.isComplete && (
          <span className="text-muted-foreground text-sm ml-2">— Thru {holesPlayed}</span>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
              <th className="p-2 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
              {activeHoles.map(h => (
                <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
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
                      <span className="font-semibold text-xs whitespace-normal break-words leading-tight">{player.displayName}</span>
                    </div>
                  </td>
                  {activeHoles.map(h => {
                    const score = holeResults[h.number]?.grossScores?.[player.id];
                    const hasScore = typeof score === 'number';
                    if (!hasScore) {
                      return <td key={h.number} className="p-1.5 border-r border-border/50"><span className="text-muted-foreground text-xs">-</span></td>;
                    }
                    const { shapeClass, colorClass } = scoreCell(score, h.par);
                    return (
                      <td key={h.number} className="p-1.5 border-r border-border/50">
                        <span className={`inline-block w-7 h-7 leading-7 ${shapeClass} text-xs font-bold ${colorClass}`}>
                          {score}
                        </span>
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
                  return <td key={h.number} className="p-1.5 border-r border-border/50 text-muted-foreground text-xs">—</td>;
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
              <td className="p-1 text-xs font-bold" />
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
