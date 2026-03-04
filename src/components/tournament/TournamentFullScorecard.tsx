import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { TournamentPlayer, TournamentGame } from '@/types/tournament';
import type { CourseHole } from '@/services/tournamentEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: TournamentPlayer[];
  teams: Record<string, { name: string; color: string }>;
  teamAssignments: Record<string, string>;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  courseHoles: CourseHole[];
  game: TournamentGame | null;
  allHoleScores: Record<string, Record<number, number>>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string; netScores?: Record<string, number> }>;
  teamTotals: Record<string, number>;
  matchState?: { resultLabel: string };
}

const TournamentFullScorecard: React.FC<Props> = ({
  isOpen, onClose, players, teams, teamAssignments, teamMatchup,
  courseHoles, game, allHoleScores, holeResults, teamTotals, matchState,
}) => {
  if (!teamMatchup || !game) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;

  const frontNine = courseHoles.filter(h => h.number <= 9);
  const backNine = courseHoles.filter(h => h.number > 9);

  const getPlayerGross = (playerId: string, holeNum: number) => allHoleScores[playerId]?.[holeNum];
  const getPlayerNet = (playerId: string, holeNum: number) => holeResults[holeNum]?.netScores?.[playerId];

  const sumGross = (playerId: string, holes: CourseHole[]) =>
    holes.reduce((s, h) => s + (getPlayerGross(playerId, h.number) ?? 0), 0);

  // Sort players by team
  const sortedPlayers = [...players].sort((a, b) => {
    const aTeam = teamAssignments[a.id];
    const bTeam = teamAssignments[b.id];
    if (aTeam !== bTeam) return aTeam === teamMatchup.teamAId ? -1 : 1;
    return 0;
  });

  const renderHoleCell = (playerId: string, hole: CourseHole) => {
    const gross = getPlayerGross(playerId, hole.number);
    const net = game.useHandicaps ? getPlayerNet(playerId, hole.number) : undefined;
    if (gross === undefined) return <td key={hole.number} className="min-w-[44px] text-center text-muted-foreground text-xs py-1">—</td>;

    const hr = holeResults[hole.number];
    const playerTeamId = teamAssignments[playerId];
    let dotColor: string | undefined;
    if (hr && hr.teamPoints) {
      const aPts = hr.teamPoints[teamMatchup.teamAId] || 0;
      const bPts = hr.teamPoints[teamMatchup.teamBId] || 0;
      if (aPts > bPts) dotColor = playerTeamId === teamMatchup.teamAId ? teamA?.color : '#6b7280';
      else if (bPts > aPts) dotColor = playerTeamId === teamMatchup.teamBId ? teamB?.color : '#6b7280';
      else if (aPts > 0) dotColor = '#9ca3af'; // halved
    }

    return (
      <td key={hole.number} className="min-w-[44px] text-center py-1">
        <div className="font-mono text-sm">{gross}</div>
        {net !== undefined && net !== gross && (
          <div className="text-[10px] text-muted-foreground">({net})</div>
        )}
        {dotColor && (
          <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ backgroundColor: dotColor }} />
        )}
      </td>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="h-[85vh] overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-sm flex items-center justify-between">
            <span>Full Scorecard</span>
            <span className="text-xs text-muted-foreground font-normal">
              {matchState?.resultLabel || `${totalA} — ${totalB}`}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto mt-2">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium min-w-[100px]">Player</th>
                <th className="sticky left-[100px] z-10 bg-card px-1 py-1.5 text-center font-medium w-6">T</th>
                {frontNine.map(h => (
                  <th key={h.number} className="min-w-[44px] text-center py-1.5 font-medium text-muted-foreground">{h.number}</th>
                ))}
                <th className="min-w-[44px] text-center py-1.5 font-bold">OUT</th>
                {backNine.map(h => (
                  <th key={h.number} className="min-w-[44px] text-center py-1.5 font-medium text-muted-foreground">{h.number}</th>
                ))}
                <th className="min-w-[44px] text-center py-1.5 font-bold">IN</th>
                <th className="min-w-[44px] text-center py-1.5 font-bold">TOT</th>
              </tr>
              {/* Par row */}
              <tr className="border-b border-border bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/30 px-2 py-1 text-muted-foreground font-medium">Par</td>
                <td className="sticky left-[100px] z-10 bg-muted/30" />
                {frontNine.map(h => (
                  <td key={h.number} className="min-w-[44px] text-center py-1 text-muted-foreground">{h.par}</td>
                ))}
                <td className="min-w-[44px] text-center py-1 font-bold text-muted-foreground">{frontNine.reduce((s, h) => s + h.par, 0)}</td>
                {backNine.map(h => (
                  <td key={h.number} className="min-w-[44px] text-center py-1 text-muted-foreground">{h.par}</td>
                ))}
                <td className="min-w-[44px] text-center py-1 font-bold text-muted-foreground">{backNine.reduce((s, h) => s + h.par, 0)}</td>
                <td className="min-w-[44px] text-center py-1 font-bold text-muted-foreground">{courseHoles.reduce((s, h) => s + h.par, 0)}</td>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map(p => {
                const teamId = teamAssignments[p.id];
                const team = teams[teamId];
                const outGross = sumGross(p.id, frontNine);
                const inGross = sumGross(p.id, backNine);

                return (
                  <tr key={p.id} className="border-b border-border">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium truncate max-w-[100px]">{p.displayName}</td>
                    <td className="sticky left-[100px] z-10 bg-card px-1 py-1.5 text-center">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: team?.color }} />
                    </td>
                    {frontNine.map(h => renderHoleCell(p.id, h))}
                    <td className="min-w-[44px] text-center py-1.5 font-bold font-mono">{outGross || '—'}</td>
                    {backNine.map(h => renderHoleCell(p.id, h))}
                    <td className="min-w-[44px] text-center py-1.5 font-bold font-mono">{inGross || '—'}</td>
                    <td className="min-w-[44px] text-center py-1.5 font-bold font-mono">{(outGross + inGross) || '—'}</td>
                  </tr>
                );
              })}

              {/* Result row */}
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1.5 font-bold text-xs">Result</td>
                <td className="sticky left-[100px] z-10 bg-muted/20" />
                {courseHoles.map(h => {
                  const hr = holeResults[h.number];
                  if (!hr || !hr.teamPoints) return <td key={h.number} className="min-w-[44px] text-center py-1 text-muted-foreground">—</td>;
                  const aPts = hr.teamPoints[teamMatchup.teamAId] || 0;
                  const bPts = hr.teamPoints[teamMatchup.teamBId] || 0;
                  let display = '—';
                  let color: string | undefined;
                  if (aPts > bPts) { display = teamA?.name?.charAt(0) || 'A'; color = teamA?.color; }
                  else if (bPts > aPts) { display = teamB?.name?.charAt(0) || 'B'; color = teamB?.color; }
                  else if (aPts > 0) { display = '½'; }

                  return (
                    <td key={h.number} className="min-w-[44px] text-center py-1 font-bold text-[10px]" style={color ? { color } : undefined}>
                      {display}
                    </td>
                  );
                })}
                {/* OUT/IN/TOT for result row - just show totals */}
                <td className="min-w-[44px]" />
                <td className="min-w-[44px]" />
                <td className="min-w-[44px]" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Team totals footer */}
        <div className="shrink-0 flex items-center justify-center gap-6 pt-3 border-t border-border text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA?.color }} />
            <span className="font-bold">{teamA?.name}: {totalA} pts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB?.color }} />
            <span className="font-bold">{teamB?.name}: {totalB} pts</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TournamentFullScorecard;
