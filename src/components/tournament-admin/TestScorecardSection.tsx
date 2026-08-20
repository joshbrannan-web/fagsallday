import React from 'react';
import { Card } from '@/components/ui/card';

export interface TestScorecardPlayer {
  id: string;
  name: string;
  teamId: string | null;
}

export interface TestScorecardResult {
  hole_number: number;
  team_points: Record<string, number> | null;
  result_label: string | null;
}

interface Props {
  title: string;
  subtitle?: string;
  players: TestScorecardPlayer[];
  teams: Record<string, { name: string; color: string }>;
  teamAId?: string | null;
  teamBId?: string | null;
  courseHoles: { number: number; par: number }[];
  /** playerId -> holeNumber -> gross */
  scores: Record<string, Record<number, number>>;
  results: TestScorecardResult[];
  pointsPerHole?: number;
  bestBall?: boolean;
  /** How many balls count for a team on a given hole (best-ball formats). Defaults to 1. */
  ballsCounted?: (holeNumber: number) => number;
  action?: React.ReactNode;
}

const TestScorecardSection: React.FC<Props> = ({
  title, subtitle, players, teams, teamAId, teamBId, courseHoles, scores, results,
  pointsPerHole = 1, bestBall = false, action,
}) => {
  const frontNine = courseHoles.filter(h => h.number <= 9);
  const backNine = courseHoles.filter(h => h.number > 9);
  const resultByHole = new Map(results.map(r => [r.hole_number, r]));

  const totals: Record<string, number> = {};
  results.forEach(r => {
    Object.entries(r.team_points || {}).forEach(([tid, pts]) => {
      totals[tid] = (totals[tid] || 0) + (Number(pts) || 0);
    });
  });

  const teamIds = [teamAId, teamBId].filter(Boolean) as string[];
  const ordered = teamIds.length
    ? [...players].sort((a, b) => teamIds.indexOf(a.teamId || '') - teamIds.indexOf(b.teamId || ''))
    : players;

  const gross = (pid: string, hole: number) => scores[pid]?.[hole];
  const sum = (pid: string, holes: { number: number }[]) =>
    holes.reduce((s, h) => s + (gross(pid, h.number) || 0), 0);

  const bestForTeam = (teamId: string | null, hole: number) => {
    if (!bestBall || !teamId) return undefined;
    const vals = players
      .filter(p => p.teamId === teamId)
      .map(p => gross(p.id, hole))
      .filter((v): v is number => typeof v === 'number');
    return vals.length ? Math.min(...vals) : undefined;
  };

  // Match status
  const holesPlayed = results.length;
  const totalA = teamAId ? totals[teamAId] || 0 : 0;
  const totalB = teamBId ? totals[teamBId] || 0 : 0;
  const totalAvailable = courseHoles.length * pointsPerHole;
  const remaining = Math.max(0, totalAvailable - (totalA + totalB));
  const hasMatch = !!(teamAId && teamBId);
  const isComplete = hasMatch && (
    holesPlayed >= courseHoles.length ||
    (totalA !== totalB && Math.abs(totalA - totalB) > remaining)
  );
  const leaderName = totalA > totalB ? teams[teamAId!]?.name : teams[teamBId!]?.name;
  let statusLine = '';
  if (hasMatch) {
    if (isComplete) {
      statusLine = totalA === totalB
        ? `Match Halved ${totalA} — ${totalB}`
        : `${leaderName} wins ${Math.max(totalA, totalB)} — ${Math.min(totalA, totalB)}`;
    } else if (totalA === totalB) {
      statusLine = `All Square • Thru ${holesPlayed} • ${remaining} pts left`;
    } else {
      statusLine = `${leaderName} leads ${Math.abs(totalA - totalB)} • Thru ${holesPlayed} • ${remaining} pts left`;
    }
  }

  const holeDot = (hole: number) => {
    const res = resultByHole.get(hole);
    if (!res) return <span className="text-muted-foreground">—</span>;
    const tp = res.team_points || {};
    const a = teamAId ? Number(tp[teamAId] || 0) : 0;
    const b = teamBId ? Number(tp[teamBId] || 0) : 0;
    if (a > b) return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teams[teamAId!]?.color }} />;
    if (b > a) return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teams[teamBId!]?.color }} />;
    return <span className="text-muted-foreground">½</span>;
  };

  const renderScoreCells = (p: TestScorecardPlayer, holes: { number: number; par: number }[]) =>
    holes.map(h => {
      const g = gross(p.id, h.number);
      const best = bestForTeam(p.teamId, h.number);
      const muted = bestBall && g !== undefined && best !== undefined && g > best;
      return (
        <td
          key={h.number}
          className={`p-1.5 text-center font-mono ${
            muted ? 'text-muted-foreground/60'
              : g != null && g < h.par ? 'text-destructive font-bold'
              : g != null && g > h.par ? 'text-muted-foreground' : ''
          }`}
        >
          {g ?? '—'}
        </td>
      );
    });

  return (
    <Card className="overflow-hidden">
      <div className="p-3 flex flex-wrap items-center justify-between gap-2 border-b border-border">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          {hasMatch && (
            <p className={`text-xs ${isComplete ? 'text-[hsl(var(--brand-gold))] font-bold' : 'text-muted-foreground'}`}>
              {statusLine}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {teamIds.map(tid => (
            <span key={tid} className="text-xs font-mono flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teams[tid]?.color }} />
              {teams[tid]?.name || 'Team'}: {Number((totals[tid] || 0).toFixed(2))}
            </span>
          ))}
          {action}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-1.5 text-left font-medium text-muted-foreground">Hole</th>
              {frontNine.map(h => <th key={h.number} className="p-1.5 text-center w-8 font-mono">{h.number}</th>)}
              {frontNine.length > 0 && <th className="p-1.5 text-center w-8 font-bold bg-muted/50">OUT</th>}
              {backNine.map(h => <th key={h.number} className="p-1.5 text-center w-8 font-mono">{h.number}</th>)}
              {backNine.length > 0 && <th className="p-1.5 text-center w-8 font-bold bg-muted/50">IN</th>}
              <th className="p-1.5 text-center w-8 font-bold bg-muted/50">TOT</th>
            </tr>
            <tr className="border-b text-muted-foreground">
              <td className="p-1.5 text-left">Par</td>
              {frontNine.map(h => <td key={h.number} className="p-1.5 text-center font-mono">{h.par}</td>)}
              {frontNine.length > 0 && <td className="p-1.5 text-center font-mono bg-muted/50">{frontNine.reduce((s, h) => s + h.par, 0)}</td>}
              {backNine.map(h => <td key={h.number} className="p-1.5 text-center font-mono">{h.par}</td>)}
              {backNine.length > 0 && <td className="p-1.5 text-center font-mono bg-muted/50">{backNine.reduce((s, h) => s + h.par, 0)}</td>}
              <td className="p-1.5 text-center font-mono bg-muted/50">{courseHoles.reduce((s, h) => s + h.par, 0)}</td>
            </tr>
          </thead>
          <tbody>
            {ordered.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-1.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {p.teamId && teams[p.teamId] && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teams[p.teamId].color }} />
                    )}
                    <span className="font-medium truncate max-w-[110px]">{p.name}</span>
                  </div>
                </td>
                {renderScoreCells(p, frontNine)}
                {frontNine.length > 0 && (
                  <td className="p-1.5 text-center font-mono font-bold bg-muted/50">{sum(p.id, frontNine) || '—'}</td>
                )}
                {renderScoreCells(p, backNine)}
                {backNine.length > 0 && (
                  <td className="p-1.5 text-center font-mono font-bold bg-muted/50">{sum(p.id, backNine) || '—'}</td>
                )}
                <td className="p-1.5 text-center font-mono font-bold bg-muted/50">{sum(p.id, courseHoles) || '—'}</td>
              </tr>
            ))}

            {hasMatch && (
              <tr className="border-t-2 bg-muted/20">
                <td className="p-1.5 font-medium text-muted-foreground">Result</td>
                {frontNine.map(h => (
                  <td key={h.number} className="p-1.5 text-center" title={resultByHole.get(h.number)?.result_label || undefined}>
                    {holeDot(h.number)}
                  </td>
                ))}
                {frontNine.length > 0 && <td className="p-1.5 bg-muted/50" />}
                {backNine.map(h => (
                  <td key={h.number} className="p-1.5 text-center" title={resultByHole.get(h.number)?.result_label || undefined}>
                    {holeDot(h.number)}
                  </td>
                ))}
                {backNine.length > 0 && <td className="p-1.5 bg-muted/50" />}
                <td className="p-1.5 text-center font-mono font-bold bg-muted/50">
                  {teamAId && <span style={{ color: teams[teamAId]?.color }}>{Number(totalA.toFixed(2))}</span>}
                  <span className="text-muted-foreground mx-0.5">-</span>
                  {teamBId && <span style={{ color: teams[teamBId]?.color }}>{Number(totalB.toFixed(2))}</span>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {results.length > 0 && (
        <div className="p-3 border-t border-border flex flex-wrap gap-1">
          {[...results].sort((a, b) => a.hole_number - b.hole_number).map(r => (
            <span key={r.hole_number} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {r.hole_number}: {r.result_label || '—'}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TestScorecardSection;
