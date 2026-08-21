import React from 'react';
import { Card } from '@/components/ui/card';
import { strokesReceived } from '@/services/tournamentEngine';

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
  /** Optional summary of tournament points awarded for this round. */
  awardLine?: string;
  /** playerId -> effective handicap index (override ?? index). Enables stroke dots. */
  handicaps?: Record<string, number>;
  /** holeNumber -> stroke index (hole handicap 1-18). */
  holeStrokeIndex?: Record<number, number>;
  /** Whether the game applies handicaps. */
  useHandicaps?: boolean;
  /** Handicap allowance percentage (default 100). */
  handicapAllowancePercent?: number;
  action?: React.ReactNode;
}

const TestScorecardSection: React.FC<Props> = ({
  title, subtitle, players, teams, teamAId, teamBId, courseHoles, scores, results,
  pointsPerHole = 1, bestBall = false, ballsCounted, awardLine, action,
  handicaps, holeStrokeIndex, useHandicaps = true, handicapAllowancePercent = 100,
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

  // ── Handicap strokes ──────────────────────────────────────
  const showStrokes = !!handicaps && !!holeStrokeIndex && useHandicaps;
  const courseHcps: Record<string, number> = {};
  if (showStrokes) {
    players.forEach(p => {
      courseHcps[p.id] = Math.round((handicaps![p.id] ?? 0) * (handicapAllowancePercent / 100));
    });
  }
  const lowHcp = showStrokes && players.length
    ? Math.min(...players.map(p => courseHcps[p.id] ?? 0))
    : 0;
  const strokesFor = (pid: string, hole: number) => {
    if (!showStrokes) return 0;
    const si = holeStrokeIndex![hole];
    if (!si) return 0;
    return strokesReceived((courseHcps[pid] ?? 0) - lowHcp, si);
  };
  const totalStrokes = (pid: string) =>
    courseHoles.reduce((s, h) => s + strokesFor(pid, h.number), 0);

  const gross = (pid: string, hole: number) => scores[pid]?.[hole];
  const sum = (pid: string, holes: { number: number }[]) =>
    holes.reduce((s, h) => s + (gross(pid, h.number) || 0), 0);

  /** Player ids whose ball counts for their team on this hole (best-ball formats). */
  const countingIds = (teamId: string | null, hole: number): Set<string> | undefined => {
    if (!bestBall || !teamId) return undefined;
    const entries = players
      .filter(p => p.teamId === teamId)
      .map(p => ({ id: p.id, g: gross(p.id, hole) }))
      .filter((e): e is { id: string; g: number } => typeof e.g === 'number')
      .sort((a, b) => a.g - b.g);
    if (!entries.length) return undefined;
    const n = Math.max(1, ballsCounted ? ballsCounted(hole) : 1);
    return new Set(entries.slice(0, n).map(e => e.id));
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

  const net = (pid: string, hole: number) => {
    const g = gross(pid, hole);
    if (g == null) return undefined;
    return g - strokesFor(pid, hole);
  };

  /** Players whose ball counts for a team on a hole, for any format. */
  const countingSetFor = (teamId: string | null, hole: number): Set<string> => {
    if (bestBall) {
      const s = countingIds(teamId, hole);
      if (s) return s;
    }
    return new Set(
      players.filter(p => p.teamId === teamId && gross(p.id, hole) != null).map(p => p.id),
    );
  };

  const teamNet = (teamId: string, hole: number): number | undefined => {
    const set = countingSetFor(teamId, hole);
    if (!set.size) return undefined;
    let total = 0;
    set.forEach(pid => { total += net(pid, hole) ?? 0; });
    return total;
  };

  /** Winning team id for a hole, '' when halved, null when not played. */
  const holeWinnerTeam = (hole: number): string | null | '' => {
    const res = resultByHole.get(hole);
    if (!res) return null;
    const tp = res.team_points || {};
    const a = teamAId ? Number(tp[teamAId] || 0) : 0;
    const b = teamBId ? Number(tp[teamBId] || 0) : 0;
    if (a > b) return teamAId!;
    if (b > a) return teamBId!;
    return '';
  };

  const holeDot = (hole: number) => {
    const w = holeWinnerTeam(hole);
    if (w === null) return <span className="text-muted-foreground">—</span>;
    if (w === '') return <span className="text-muted-foreground">½</span>;
    return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teams[w]?.color }} />;
  };

  const renderScoreCells = (p: TestScorecardPlayer, holes: { number: number; par: number }[]) =>
    holes.map(h => {
      const g = gross(p.id, h.number);
      const counts = g != null && countingSetFor(p.teamId, h.number).has(p.id);
      const muted = g != null && !counts;
      const st = strokesFor(p.id, h.number);
      const n = net(p.id, h.number);
      const color = p.teamId ? teams[p.teamId]?.color : undefined;
      const winner = holeWinnerTeam(h.number);
      const isWinningCell = counts && !!p.teamId && winner === p.teamId;
      const isHalvedCell = counts && !!p.teamId && winner === '';
      const style: React.CSSProperties = {};
      if (counts && color) {
        style.boxShadow = `inset 0 0 0 1.5px ${color}`;
        if (isWinningCell) style.backgroundColor = `color-mix(in srgb, ${color} 24%, transparent)`;
        else if (isHalvedCell) style.backgroundColor = `color-mix(in srgb, ${color} 10%, transparent)`;
      }
      const titleParts = [
        counts ? 'Counts toward team score' : g != null ? 'Not counted' : '',
        st ? `${st} stroke${st > 1 ? 's' : ''} received` : '',
        showStrokes && n != null ? `net ${n}` : '',
      ].filter(Boolean);
      return (
        <td
          key={h.number}
          title={titleParts.length ? `${p.name} — hole ${h.number}: ${titleParts.join(' • ')}` : undefined}
          style={style}
          className={`p-1.5 text-center font-mono relative rounded-sm ${
            muted ? 'text-muted-foreground/50'
              : g != null && g < h.par ? 'text-destructive font-bold'
              : g != null && g > h.par ? 'text-muted-foreground' : ''
          }`}
        >
          <span className={counts ? 'font-semibold' : ''}>{g ?? '—'}</span>
          {showStrokes && n != null && (
            <span className="block text-[9px] leading-none text-muted-foreground">{n}</span>
          )}
          {st > 0 && (
            <span className="absolute top-0.5 right-0.5 flex gap-[1px]">
              {Array.from({ length: st }).map((_, i) => (
                <span key={i} className="w-1 h-1 rounded-full bg-[hsl(var(--brand-gold))] inline-block" />
              ))}
            </span>
          )}
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
          {showStrokes && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[hsl(var(--brand-gold))] inline-block" />
              Gold dots mark holes where a player receives a handicap stroke (relative to the low handicap here).
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Outlined scores count toward the team score{showStrokes ? ' (small number = net)' : ''}; dimmed scores don't count; tinted cells are the hole winner's counting scores.
          </p>

          {awardLine && (
            <p className="text-xs text-[hsl(var(--brand-gold))] font-semibold truncate">{awardLine}</p>
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
                    {showStrokes && (
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {totalStrokes(p.id) > 0 ? `+${totalStrokes(p.id)}` : 'scratch'}
                      </span>
                    )}
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

            {hasMatch && teamIds.map(tid => {
              const cell = (h: { number: number }) => {
                const v = teamNet(tid, h.number);
                const win = holeWinnerTeam(h.number) === tid;
                return (
                  <td
                    key={h.number}
                    className={`p-1.5 text-center font-mono ${win ? 'font-bold' : ''}`}
                    style={{ color: teams[tid]?.color }}
                    title={`${teams[tid]?.name || 'Team'} counting ${showStrokes ? 'net' : 'gross'} total on hole ${h.number}`}
                  >
                    {v ?? '—'}
                  </td>
                );
              };
              return (
                <tr key={`net-${tid}`} className="border-t bg-muted/10">
                  <td className="p-1.5 whitespace-nowrap text-[11px] font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teams[tid]?.color }} />
                    <span className="truncate max-w-[110px]">{teams[tid]?.name || 'Team'}</span>
                    <span className="text-muted-foreground">{showStrokes ? 'net' : 'gross'}</span>
                  </td>
                  {frontNine.map(cell)}
                  {frontNine.length > 0 && <td className="p-1.5 bg-muted/50" />}
                  {backNine.map(cell)}
                  {backNine.length > 0 && <td className="p-1.5 bg-muted/50" />}
                  <td className="p-1.5 bg-muted/50" />
                </tr>
              );
            })}

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
