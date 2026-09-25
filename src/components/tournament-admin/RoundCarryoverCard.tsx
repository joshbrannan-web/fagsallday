import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CloudRain, RefreshCw } from 'lucide-react';
import { calcCourseHandicap, strokesReceived } from '@/services/tournamentEngine';
import { resolveSubMatchups } from '@/lib/subMatchups';

/**
 * Finishes a weather-shortened round using the opening holes of a later round.
 * Scores are only entered on the later round; this card compares each unfinished
 * source matchup (blind if the players are in different groups) on the later
 * round's holes, using the later course's stroke indexes, and writes the point
 * winners into the source round's missing holes. No gross scores are copied.
 */

interface Props {
  sourceRound: any;
  rounds: any[];
  onApplied?: () => void;
}

interface HoleOutcome {
  sourceHole: number;
  targetHole: number;
  pts: Record<string, number>; // playerId -> points (1 / 0.5 / 0)
  net: Record<string, number | undefined>;
  strokes: Record<string, number>;
  done: boolean;
}

interface MatchOutcome {
  groupId: string;
  a: string;
  b: string;
  blind: boolean;
  priorA: number;
  priorB: number;
  holes: HoleOutcome[];
}

export default function RoundCarryoverCard({ sourceRound, rounds, onApplied }: Props) {
  const later = rounds.filter((r: any) => r.round_number > sourceRound.round_number);
  const savedTarget = later.find((r: any) => r.course_data?.carryover?.sourceRoundId === sourceRound.id);
  const [targetId, setTargetId] = useState<string>(savedTarget?.id || '');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const roundIds = [sourceRound.id, targetId].filter(Boolean);
      const { data: groups } = await supabase
        .from('tournament_groups').select('id, tournament_round_id, team_matchup, is_test')
        .in('tournament_round_id', roundIds).eq('is_test', false);
      const groupIds = (groups || []).map(g => g.id);
      const [gp, results, scores, players, games] = await Promise.all([
        supabase.from('tournament_group_players').select('tournament_group_id, tournament_player_id, team_id').in('tournament_group_id', groupIds),
        supabase.from('tournament_hole_results').select('tournament_group_id, hole_number, player_points').in('tournament_group_id', groupIds),
        supabase.from('tournament_hole_scores').select('tournament_group_id, tournament_player_id, hole_number, gross_score').in('tournament_group_id', groupIds),
        supabase.from('tournament_players').select('id, display_name, handicap_index, handicap_override').eq('tournament_id', sourceRound.tournament_id),
        supabase.from('tournament_games').select('tournament_round_id, use_handicaps, handicap_allowance_percent').in('tournament_round_id', roundIds),
      ]);
      setData({ groups: groups || [], gp: gp.data || [], results: results.data || [], scores: scores.data || [], players: players.data || [], games: games.data || [] });
    } finally {
      setLoading(false);
    }
  }, [sourceRound.id, sourceRound.tournament_id, targetId]);

  useEffect(() => { load(); }, [load]);

  const computed = useMemo(() => {
    if (!data) return null;
    const srcHoles: any[] = sourceRound.course_data?.holes || [];
    const srcGroups = data.groups.filter((g: any) => g.tournament_round_id === sourceRound.id);
    const srcGroupIds = new Set(srcGroups.map((g: any) => g.id));
    const playedHoles = new Set<number>(data.results.filter((r: any) => srcGroupIds.has(r.tournament_group_id)).map((r: any) => r.hole_number));
    const lastPlayed = Math.max(0, ...Array.from(playedHoles));
    const missing = srcHoles.map(h => h.number).filter((n: number) => n > lastPlayed).sort((a: number, b: number) => a - b);
    if (missing.length === 0) return { missing, matches: [] as MatchOutcome[] };

    const target = rounds.find((r: any) => r.id === targetId);
    const tgtHoles: any[] = target?.course_data?.holes || [];
    const holeMap = missing.map((sh: number, i: number) => ({ sourceHole: sh, targetHole: i + 1 }));
    const siByHole: Record<number, number> = {};
    tgtHoles.forEach(h => { siByHole[h.number] = h.handicapIndex; });

    const tgtGroupIds = new Set(data.groups.filter((g: any) => g.tournament_round_id === targetId).map((g: any) => g.id));
    const tgtGroupOf: Record<string, string> = {};
    data.gp.forEach((x: any) => { if (tgtGroupIds.has(x.tournament_group_id)) tgtGroupOf[x.tournament_player_id] = x.tournament_group_id; });
    const gross: Record<string, Record<number, number>> = {};
    data.scores.forEach((s: any) => {
      if (!tgtGroupIds.has(s.tournament_group_id) || s.gross_score == null) return;
      (gross[s.tournament_player_id] ||= {})[s.hole_number] = s.gross_score;
    });

    const game = data.games.find((g: any) => g.tournament_round_id === sourceRound.id);
    const useHcp = game?.use_handicaps !== false;
    const allowance = (game?.handicap_allowance_percent ?? 100) / 100;
    const playerById: Record<string, any> = {};
    data.players.forEach((p: any) => { playerById[p.id] = p; });
    const ch = (id: string) => {
      const p = playerById[id];
      return calcCourseHandicap(Number(p?.handicap_override ?? p?.handicap_index ?? 0) * allowance);
    };

    const matches: MatchOutcome[] = [];
    srcGroups.forEach((g: any) => {
      resolveSubMatchups(g.team_matchup)
        .filter((m: any) => missing.some((h: number) => h >= (m.holeStart ?? 1) && h <= (m.holeEnd ?? 18)))
        .forEach((m: any) => {
          const a = m.playerA, b = m.playerB;
          let priorA = 0, priorB = 0;
          data.results.forEach((r: any) => {
            if (r.tournament_group_id !== g.id) return;
            if (r.hole_number < (m.holeStart ?? 1) || r.hole_number > (m.holeEnd ?? 18)) return;
            priorA += Number(r.player_points?.[a] || 0);
            priorB += Number(r.player_points?.[b] || 0);
          });
          const diff = useHcp ? ch(a) - ch(b) : 0;
          const holes: HoleOutcome[] = holeMap.map(({ sourceHole, targetHole }) => {
            const si = siByHole[targetHole] ?? 18;
            const strokes = {
              [a]: diff > 0 ? strokesReceived(diff, si) : 0,
              [b]: diff < 0 ? strokesReceived(-diff, si) : 0,
            };
            const ga = gross[a]?.[targetHole], gb = gross[b]?.[targetHole];
            const na = ga != null ? ga - strokes[a] : undefined;
            const nb = gb != null ? gb - strokes[b] : undefined;
            const done = na != null && nb != null;
            const pts: Record<string, number> = { [a]: 0, [b]: 0 };
            if (done) {
              if (na! < nb!) pts[a] = 1; else if (nb! < na!) pts[b] = 1; else { pts[a] = 0.5; pts[b] = 0.5; }
            }
            return { sourceHole, targetHole, pts, net: { [a]: na, [b]: nb }, strokes, done };
          });
          matches.push({ groupId: g.id, a, b, blind: !!tgtGroupOf[a] && tgtGroupOf[a] !== tgtGroupOf[b], priorA, priorB, holes });
        });
    });
    return { missing, matches, holeMap };
  }, [data, sourceRound, rounds, targetId]);

  const name = (id: string) => data?.players.find((p: any) => p.id === id)?.display_name || '—';

  const saveTarget = async (id: string) => {
    setTargetId(id);
    const target = rounds.find((r: any) => r.id === id);
    if (!target) return;
    const course_data = { ...(target.course_data || {}), carryover: { sourceRoundId: sourceRound.id } };
    await supabase.from('tournament_rounds').update({ course_data }).eq('id', id);
  };

  const apply = async () => {
    if (!computed || !data) return;
    setApplying(true);
    try {
      const teamOf: Record<string, string> = {};
      data.gp.forEach((x: any) => { if (x.tournament_group_id && computed.matches.some(m => m.groupId === x.tournament_group_id)) teamOf[x.tournament_player_id] = x.team_id; });
      const rows: any[] = [];
      const groupIds = Array.from(new Set(computed.matches.map(m => m.groupId)));
      groupIds.forEach(gid => {
        const ms = computed.matches.filter(m => m.groupId === gid);
        computed.missing.forEach((sh: number, idx: number) => {
          const hs = ms.map(m => ({ m, h: m.holes[idx] }));
          if (!hs.every(x => x.h.done)) return;
          const player_points: Record<string, number> = {};
          const team_points: Record<string, number> = {};
          const labels: string[] = [];
          hs.forEach(({ m, h }) => {
            [m.a, m.b].forEach(p => {
              player_points[p] = h.pts[p];
              const t = teamOf[p];
              if (t) team_points[t] = (team_points[t] || 0) + h.pts[p];
            });
            labels.push(h.pts[m.a] === 0.5 ? 'Halved' : `${name(h.pts[m.a] === 1 ? m.a : m.b)} wins`);
          });
          rows.push({
            tournament_group_id: gid, hole_number: sh, is_test: false,
            player_points, team_points, points_value: ms.length,
            result_label: `${labels.join(' · ')} (finished at Round ${rounds.find((r: any) => r.id === targetId)?.round_number} hole ${idx + 1})`,
            updated_at: new Date().toISOString(),
          });
        });
      });
      if (rows.length === 0) { toast.info('No finished carryover holes yet'); return; }
      const { error } = await supabase.from('tournament_hole_results').upsert(rows, { onConflict: 'tournament_group_id,hole_number' });
      if (error) throw error;
      toast.success(`Saved ${rows.length / groupIds.length || rows.length} carryover hole(s) to ${sourceRound.name || 'the round'}`);
      await load();
      onApplied?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save carryover results');
    } finally {
      setApplying(false);
    }
  };

  if (!computed || computed.missing.length === 0) return null;

  return (
    <Card className="p-3 space-y-3 border-dashed">
      <div className="flex items-center gap-2">
        <CloudRain className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium flex-1">
          Holes {computed.missing[0]}–{computed.missing[computed.missing.length - 1]} unfinished
        </p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <Select value={targetId} onValueChange={saveTarget}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Finish using the opening holes of…" /></SelectTrigger>
        <SelectContent>
          {later.map((r: any) => (
            <SelectItem key={r.id} value={r.id}>Round {r.round_number} · {r.name || 'Round'} holes 1–{computed.missing.length}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {targetId && (
        <>
          <p className="text-xs text-muted-foreground">
            Strokes use the new course's hole stroke indexes. Scores are only entered in the new round.
          </p>
          <div className="space-y-2">
            {computed.matches.map((m, i) => {
              const addA = m.holes.reduce((s, h) => s + h.pts[m.a], 0);
              const addB = m.holes.reduce((s, h) => s + h.pts[m.b], 0);
              return (
                <div key={i} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{name(m.a)} vs {name(m.b)}</span>
                    {m.blind && <Badge variant="outline" className="text-[10px]">Blind</Badge>}
                  </div>
                  <div className="grid gap-1 text-[11px]" style={{ gridTemplateColumns: `auto repeat(${m.holes.length}, minmax(0,1fr)) auto` }}>
                    <span className="text-muted-foreground">Hole</span>
                    {m.holes.map(h => <span key={h.sourceHole} className="text-center text-muted-foreground">{h.sourceHole}<span className="block text-[9px]">({h.targetHole})</span></span>)}
                    <span className="text-right text-muted-foreground">Total</span>
                    {[m.a, m.b].map((p, pi) => (
                      <React.Fragment key={p}>
                        <span className="truncate max-w-[80px]">{name(p).split(' ')[0]}</span>
                        {m.holes.map(h => (
                          <span key={h.sourceHole} className={`relative text-center rounded ${h.done && h.pts[p] === 1 ? 'bg-primary/20 font-semibold' : ''}`}>
                            {h.net[p] ?? '·'}
                            {h.strokes[p] > 0 && <span className="absolute -top-0.5 right-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand-gold))]" />}
                          </span>
                        ))}
                        <span className="text-right font-semibold">{(pi === 0 ? m.priorA + addA : m.priorB + addB)}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Through hole {computed.missing[0] - 1}: {m.priorA}–{m.priorB} · net scores shown</p>
                </div>
              );
            })}
          </div>
          <Button size="sm" className="w-full" onClick={apply} disabled={applying}>
            {applying ? 'Saving…' : 'Save finished holes to this round'}
          </Button>
        </>
      )}
    </Card>
  );
}
