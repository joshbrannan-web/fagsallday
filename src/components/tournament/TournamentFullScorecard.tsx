import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { TournamentPlayer, TournamentGame, MatchState } from '@/types/tournament';
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
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string; netScores?: Record<string, number>; grossScores?: Record<string, number>; pointsValue?: number; playerPoints?: Record<string, number> }>;
  teamTotals: Record<string, number>;
  matchState?: MatchState;
  tournamentName?: string;
  roundName?: string;
  subMatchups?: { playerA: string; playerB: string }[];
}

const TournamentFullScorecard: React.FC<Props> = ({
  isOpen, onClose, players, teams, teamAssignments, teamMatchup,
  courseHoles, game, allHoleScores, holeResults, teamTotals, matchState,
  tournamentName, roundName, subMatchups,
}) => {
  if (!teamMatchup || !game) return null;

  const frontNine = courseHoles.filter(h => h.number <= 9);
  const backNine = courseHoles.filter(h => h.number > 9);

  const getPlayerGross = (playerId: string, holeNum: number) => allHoleScores[playerId]?.[holeNum];
  const getPlayerNet = (playerId: string, holeNum: number) => holeResults[holeNum]?.netScores?.[playerId];
  const sumGross = (playerId: string, holes: CourseHole[]) =>
    holes.reduce((s, h) => s + (getPlayerGross(playerId, h.number) ?? 0), 0);

  const isTeamFormat = game.gameType?.startsWith('scramble_') || game.gameType?.startsWith('alternate_shot_');
  const isGrossBestBall = game.gameType === 'match_play_gross_best_ball';

  const getBestGrossForTeam = (holeNum: number, teamId: string): number | undefined => {
    const teamPlayers = players.filter(p => teamAssignments[p.id] === teamId);
    const scores = teamPlayers.map(p => getPlayerGross(p.id, holeNum)).filter((s): s is number => s !== undefined);
    return scores.length > 0 ? Math.min(...scores) : undefined;
  };

  const has1v1 = subMatchups && subMatchups.length > 0;

  const renderHoleCell = (playerId: string, hole: CourseHole) => {
    const gross = getPlayerGross(playerId, hole.number);
    const net = game.useHandicaps ? getPlayerNet(playerId, hole.number) : undefined;
    if (gross === undefined) return <td key={hole.number} className="min-w-[44px] text-center text-muted-foreground text-xs py-1">—</td>;

    const playerTeamId = teamAssignments[playerId];

    let isMuted = false;
    if (isGrossBestBall && playerTeamId) {
      const best = getBestGrossForTeam(hole.number, playerTeamId);
      if (best !== undefined && gross > best) isMuted = true;
    }

    return (
      <td key={hole.number} className="min-w-[44px] text-center py-1">
        <div className={`font-mono text-sm ${isMuted ? 'text-muted-foreground/50' : isGrossBestBall && !isMuted ? 'font-bold' : ''}`}>
          {gross}
          {isTeamFormat && <sup className="text-[8px] text-muted-foreground ml-0.5">T</sup>}
        </div>
        {net !== undefined && net !== gross && (
          <div className="text-[10px] text-muted-foreground">({net})</div>
        )}
      </td>
    );
  };

  // Shared table header
  const renderTableHeader = () => (
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
  );

  const renderPlayerRow = (p: TournamentPlayer) => {
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
  };

  // 1v1: separate sections per matchup
  if (has1v1) {
    const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
    const normalizeMatchup = (sm: { playerA: string; playerB: string }) =>
      teamAssignments[sm.playerA] === teamMatchup!.teamAId ? sm : { playerA: sm.playerB, playerB: sm.playerA };

    return (
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="bottom" className="h-[85vh] overflow-hidden flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-sm">
              {tournamentName || 'Full Scorecard'}{roundName ? ` — ${roundName}` : ''}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto mt-2 space-y-6">
            {subMatchups!.map((rawSm, idx) => {
              const sm = normalizeMatchup(rawSm);
              const pA = playerMap[sm.playerA];
              const pB = playerMap[sm.playerB];
              if (!pA || !pB) return null;

              // Per-match points
              let aPts = 0, bPts = 0;
              Object.values(holeResults).forEach(hr => {
                aPts += hr.playerPoints?.[sm.playerA] || 0;
                bPts += hr.playerPoints?.[sm.playerB] || 0;
              });

              const aName = pA.displayName.split(' ')[0];
              const bName = pB.displayName.split(' ')[0];
              let matchStatus = 'All Square';
              if (aPts > bPts) matchStatus = `${aName} ${aPts} — ${bPts}`;
              else if (bPts > aPts) matchStatus = `${bName} ${bPts} — ${aPts}`;
              else matchStatus = `All Square ${aPts} — ${bPts}`;

              const renderMatchResultCell = (hole: CourseHole) => {
                const hr = holeResults[hole.number];
                if (!hr || !hr.playerPoints) return <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 text-muted-foreground">—</td>;
                const ppA = hr.playerPoints[sm.playerA] || 0;
                const ppB = hr.playerPoints[sm.playerB] || 0;
                if (ppA === 0 && ppB === 0) return <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 text-muted-foreground">—</td>;
                if (ppA === ppB) return <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 font-bold text-[10px] text-muted-foreground">½</td>;
                const winnerId = ppA > ppB ? sm.playerA : sm.playerB;
                const winnerTeam = teams[teamAssignments[winnerId]];
                return (
                  <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 font-bold text-[10px]" style={{ color: winnerTeam?.color }}>
                    {winnerTeam?.name?.charAt(0) || '●'}
                  </td>
                );
              };

              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Match {idx + 1}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{matchStatus}</span>
                  </div>
                  <table className="text-xs border-collapse">
                    {renderTableHeader()}
                    <tbody>
                      {renderPlayerRow(pA)}
                      {renderPlayerRow(pB)}
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1.5 font-bold text-xs">Result</td>
                        <td className="sticky left-[100px] z-10 bg-muted/20" />
                        {frontNine.map(h => renderMatchResultCell(h))}
                        <td className="min-w-[44px]" />
                        {backNine.map(h => renderMatchResultCell(h))}
                        <td className="min-w-[44px]" />
                        <td className="min-w-[44px]" />
                      </tr>
                    </tbody>
                  </table>

                  {/* Per-match footer */}
                  <div className="flex items-center justify-center gap-6 pt-2 text-sm">
                    {[{ p: pA, pts: aPts }, { p: pB, pts: bPts }].map(({ p, pts }) => (
                      <span key={p.id} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teams[teamAssignments[p.id]]?.color }} />
                        <span className="font-bold">{p.displayName.split(' ')[0]}: {pts} pts</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Default combined view
  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;

  const sortedPlayers = [...players].sort((a, b) => {
    const aTeam = teamAssignments[a.id];
    const bTeam = teamAssignments[b.id];
    if (aTeam !== bTeam) return aTeam === teamMatchup.teamAId ? -1 : 1;
    return 0;
  });

  const statusText = matchState?.isComplete
    ? (totalA === totalB ? `Match Halved ${totalA} — ${totalB}` : `${totalA > totalB ? teamA?.name : teamB?.name} wins ${Math.max(totalA, totalB)} — ${Math.min(totalA, totalB)}`)
    : `${totalA} — ${totalB}`;

  const renderResultCell = (hole: CourseHole) => {
    const hr = holeResults[hole.number];
    if (!hr || !hr.teamPoints) return <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 text-muted-foreground">—</td>;
    const aPts = hr.teamPoints[teamMatchup.teamAId] || 0;
    const bPts = hr.teamPoints[teamMatchup.teamBId] || 0;
    let display = '—';
    let color: string | undefined;
    if (aPts > bPts) { display = teamA?.name?.charAt(0) || 'A'; color = teamA?.color; }
    else if (bPts > aPts) { display = teamB?.name?.charAt(0) || 'B'; color = teamB?.color; }
    else if (aPts > 0) { display = '½'; }
    return (
      <td key={`r-${hole.number}`} className="min-w-[44px] text-center py-1 font-bold text-[10px]" style={color ? { color } : undefined}>
        {display}
      </td>
    );
  };

  const renderPointsCell = (hole: CourseHole) => {
    const hr = holeResults[hole.number];
    if (!hr || hr.pointsValue === undefined) return <td key={`p-${hole.number}`} className="min-w-[44px] text-center py-1 text-muted-foreground text-[10px]">—</td>;
    return (
      <td key={`p-${hole.number}`} className="min-w-[44px] text-center py-1 font-mono text-[10px] text-muted-foreground">
        {hr.pointsValue}
      </td>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="h-[85vh] overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-sm flex items-center justify-between">
            <span>{tournamentName || 'Full Scorecard'}{roundName ? ` — ${roundName}` : ''}</span>
            <span className="text-xs text-muted-foreground font-normal">{statusText}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto mt-2">
          <table className="text-xs border-collapse">
            {renderTableHeader()}
            <tbody>
              {sortedPlayers.map(p => renderPlayerRow(p))}
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1.5 font-bold text-xs">Result</td>
                <td className="sticky left-[100px] z-10 bg-muted/20" />
                {frontNine.map(h => renderResultCell(h))}
                <td className="min-w-[44px]" />
                {backNine.map(h => renderResultCell(h))}
                <td className="min-w-[44px]" />
                <td className="min-w-[44px]" />
              </tr>
              <tr className="border-b border-border bg-muted/10">
                <td className="sticky left-0 z-10 bg-muted/10 px-2 py-1 font-bold text-xs text-muted-foreground">Pts</td>
                <td className="sticky left-[100px] z-10 bg-muted/10" />
                {frontNine.map(h => renderPointsCell(h))}
                <td className="min-w-[44px] text-center py-1 font-mono text-[10px] font-bold">
                  {frontNine.reduce((s, h) => s + (holeResults[h.number]?.pointsValue || 0), 0) || ''}
                </td>
                {backNine.map(h => renderPointsCell(h))}
                <td className="min-w-[44px] text-center py-1 font-mono text-[10px] font-bold">
                  {backNine.reduce((s, h) => s + (holeResults[h.number]?.pointsValue || 0), 0) || ''}
                </td>
                <td className="min-w-[44px] text-center py-1 font-mono text-[10px] font-bold">
                  {courseHoles.reduce((s, h) => s + (holeResults[h.number]?.pointsValue || 0), 0) || ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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
