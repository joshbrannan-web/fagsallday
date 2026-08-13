import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import MatchStatusBar from './MatchStatusBar';
import HoleResultDots from './HoleResultDots';
import { toast } from 'sonner';

interface ScoreEdit {
  playerId: string;
  hole: number;
  score: number;
}

interface Props {
  groupPlayers: any[];
  teams: any[];
  scores: any[];
  results: any[];
  courseHoles?: { number: number; par: number; handicapIndex?: number }[];
  onBatchSave: (edits: ScoreEdit[]) => Promise<void>;
}

const FRONT = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK = Array.from({ length: 9 }, (_, i) => i + 10);

const GroupScorecardAdmin: React.FC<Props> = ({ groupPlayers, teams, scores, results, courseHoles = [], onBatchSave }) => {
  const [editCell, setEditCell] = useState<{ playerId: string; hole: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Map<string, ScoreEdit>>(new Map());
  const [saving, setSaving] = useState(false);
  const editValueRef = useRef('');

  const makeKey = (playerId: string, hole: number) => `${playerId}:${hole}`;

  const orderedPlayers = useMemo(() => {
    const teamIndex = (teamId: string | null | undefined) => {
      const idx = teams.findIndex((t: any) => t.id === teamId);
      return idx === -1 ? teams.length : idx;
    };
    return [...groupPlayers]
      .map((gp: any, i: number) => ({ gp, i }))
      .sort((a, b) => {
        const d = teamIndex(a.gp.team_id) - teamIndex(b.gp.team_id);
        return d !== 0 ? d : a.i - b.i;
      })
      .map(x => x.gp);
  }, [groupPlayers, teams]);

  const playerIds = useMemo(
    () => orderedPlayers.map((gp: any) => gp.tournament_player_id || gp.id),
    [orderedPlayers],
  );

  const savedScore = (playerId: string, hole: number) =>
    scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === hole);

  const getScore = (playerId: string, hole: number) => {
    const pending = pendingEdits.get(makeKey(playerId, hole));
    if (pending) return { gross: pending.score, isOverride: true, isPending: true };
    const s = savedScore(playerId, hole);
    return s && s.gross_score != null
      ? { gross: s.gross_score as number, isOverride: s.is_super_user_override, isPending: false }
      : null;
  };

  const getResult = (hole: number) => results.find((r: any) => r.hole_number === hole);

  const parFor = (hole: number) => courseHoles.find(h => h.number === hole)?.par;

  const sumPars = (holes: number[]) =>
    holes.reduce((acc, h) => acc + (parFor(h) ?? 0), 0);

  const sumScores = (playerId: string, holes: number[]) =>
    holes.reduce((acc, h) => acc + (getScore(playerId, h)?.gross ?? 0), 0);

  const startEdit = (playerId: string, hole: number) => {
    const current = getScore(playerId, hole)?.gross;
    setEditCell({ playerId, hole });
    const v = current?.toString() || '';
    setEditValue(v);
    editValueRef.current = v;
  };

  const applyValue = (playerId: string, hole: number, raw: string) => {
    const key = makeKey(playerId, hole);
    const val = parseInt(raw, 10);
    const existing = savedScore(playerId, hole);
    if (isNaN(val) || val < 1) return;
    if (existing?.gross_score === val) {
      setPendingEdits(prev => { const next = new Map(prev); next.delete(key); return next; });
    } else {
      setPendingEdits(prev => new Map(prev).set(key, { playerId, hole, score: val }));
    }
  };

  const commitEdit = (moveTo?: { playerId: string; hole: number } | null) => {
    if (!editCell) return;
    applyValue(editCell.playerId, editCell.hole, editValueRef.current);
    if (moveTo) startEdit(moveTo.playerId, moveTo.hole);
    else setEditCell(null);
  };

  const neighbor = (playerId: string, hole: number, dir: 'next' | 'prev' | 'up' | 'down') => {
    const pIdx = playerIds.indexOf(playerId);
    if (dir === 'up' || dir === 'down') {
      const nextIdx = dir === 'up' ? pIdx - 1 : pIdx + 1;
      if (nextIdx < 0 || nextIdx >= playerIds.length) return null;
      return { playerId: playerIds[nextIdx], hole };
    }
    if (dir === 'next') {
      if (pIdx < playerIds.length - 1) return { playerId: playerIds[pIdx + 1], hole };
      if (hole < 18) return { playerId: playerIds[0], hole: hole + 1 };
      return null;
    }
    if (pIdx > 0) return { playerId: playerIds[pIdx - 1], hole };
    if (hole > 1) return { playerId: playerIds[playerIds.length - 1], hole: hole - 1 };
    return null;
  };

  const handleSaveAll = async () => {
    if (pendingEdits.size === 0) return;
    setSaving(true);
    const count = pendingEdits.size;
    try {
      await onBatchSave(Array.from(pendingEdits.values()));
      setPendingEdits(new Map());
      toast.success(`Saved ${count} score${count > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to save scores');
    }
    setSaving(false);
  };

  const holesPlayed = results.filter((r: any) => r.team_points && Object.keys(r.team_points).length > 0).length;

  const holeResultDots = Array.from({ length: 18 }, (_, i) => {
    const r = getResult(i + 1);
    const teamPoints = r?.team_points as Record<string, number> | undefined;
    if (!r || !teamPoints || Object.keys(teamPoints).length === 0) {
      return { holeNumber: i + 1, isPlayed: false, isHalved: false };
    }
    const entries = Object.entries(teamPoints);
    const maxPoints = Math.max(...entries.map(([, v]) => v));
    const winners = entries.filter(([, v]) => v === maxPoints);
    if (winners.length > 1) return { holeNumber: i + 1, isPlayed: true, isHalved: true };
    const winTeam = teams.find((t: any) => t.id === winners[0]?.[0]);
    return { holeNumber: i + 1, isPlayed: true, isHalved: false, winningTeamColor: winTeam?.color };
  });

  const teamColor = (gp: any) => teams.find((t: any) => t.id === gp.team_id)?.color;

  // Team point totals for this group's match (saved results only)
  const matchTeams = useMemo(() => {
    const ids = teams
      .filter((t: any) => groupPlayers.some((gp: any) => gp.team_id === t.id))
      .map((t: any) => t.id);
    if (ids.length < 2) return null;
    const totals: Record<string, number> = {};
    ids.forEach((id: string) => { totals[id] = 0; });
    results.forEach((r: any) => {
      const tp = r?.team_points as Record<string, number> | undefined;
      if (!tp) return;
      ids.forEach((id: string) => { totals[id] += Number(tp[id]) || 0; });
    });
    return ids.slice(0, 2).map((id: string) => {
      const t = teams.find((x: any) => x.id === id);
      return { id, name: t?.name || 'Team', color: t?.color, points: totals[id] };
    });
  }, [teams, groupPlayers, results]);


  // Winning team / players for a hole (null when halved or not played)
  const holeWinner = (hole: number): { teamId?: string; playerIds?: string[] } | null => {
    const r = getResult(hole);
    if (!r) return null;
    const teamPoints = r.team_points as Record<string, number> | undefined;
    if (teamPoints && Object.keys(teamPoints).length > 0) {
      const entries = Object.entries(teamPoints);
      const max = Math.max(...entries.map(([, v]) => v));
      const winners = entries.filter(([, v]) => v === max);
      if (winners.length !== 1 || max <= 0) return null;
      return { teamId: winners[0][0] };
    }
    const playerPoints = r.player_points as Record<string, number> | undefined;
    if (playerPoints && Object.keys(playerPoints).length > 0) {
      const entries = Object.entries(playerPoints);
      const max = Math.max(...entries.map(([, v]) => v));
      if (max <= 0) return null;
      const winners = entries.filter(([, v]) => v === max).map(([k]) => k);
      if (winners.length === entries.length) return null;
      return { playerIds: winners };
    }
    return null;
  };

  const winnerStyle = (gp: any, playerId: string, hole: number): React.CSSProperties | undefined => {
    const w = holeWinner(hole);
    if (!w) return undefined;
    const isWinner = w.teamId ? gp.team_id === w.teamId : w.playerIds?.includes(playerId);
    if (!isWinner) return undefined;
    const color = teamColor(gp);
    if (!color) return undefined;
    return {
      border: `2px solid ${color}`,
      backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
    };
  };

  const shortResult = (hole: number) => {
    const r = getResult(hole);
    if (!r) return '';
    const label = r.result_label as string | undefined;
    return label || '';
  };

  const renderNine = (holes: number[], label: 'OUT' | 'IN') => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th className="sticky left-0 z-10 bg-muted/60 text-left px-2 py-2 font-semibold min-w-[92px]">Hole</th>
            {holes.map(h => (
              <th key={h} className="px-1 py-2 font-semibold text-center min-w-[44px]">{h}</th>
            ))}
            <th className="px-2 py-2 font-bold text-center min-w-[44px]">{label}</th>
          </tr>
        </thead>
        <tbody>
          {courseHoles.length > 0 && (
            <tr className="border-t border-border bg-muted/20 text-muted-foreground">
              <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1.5 font-medium">Par</td>
              {holes.map(h => (
                <td key={h} className="px-1 py-1.5 text-center font-mono">{parFor(h) ?? '—'}</td>
              ))}
              <td className="px-2 py-1.5 text-center font-mono font-semibold">{sumPars(holes) || '—'}</td>
            </tr>
          )}

          {orderedPlayers.map((gp: any) => {
            const playerId = gp.tournament_player_id || gp.id;
            const color = teamColor(gp);
            return (
              <tr key={gp.id} className="border-t border-border">
                <td
                  className="sticky left-0 z-10 bg-background px-2 py-1 font-medium truncate max-w-[120px] border-l-4"
                  style={{ borderLeftColor: color || 'transparent' }}
                  title={gp.display_name}
                >
                  {gp.display_name || playerId?.slice(0, 6)}
                </td>
                {holes.map(hole => {
                  const score = getScore(playerId, hole);
                  const isEditing = editCell?.playerId === playerId && editCell?.hole === hole;
                  return (
                    <td key={hole} className="p-0.5 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={editValue}
                          onChange={e => {
                            const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                            setEditValue(v);
                            editValueRef.current = v;
                          }}
                          onFocus={e => e.currentTarget.select()}
                          onBlur={() => commitEdit(null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              commitEdit(neighbor(playerId, hole, e.shiftKey ? 'prev' : 'next'));
                            } else if (e.key === 'Escape') {
                              setEditCell(null);
                            } else if (e.key === 'ArrowRight') {
                              e.preventDefault(); commitEdit(neighbor(playerId, hole, 'next'));
                            } else if (e.key === 'ArrowLeft') {
                              e.preventDefault(); commitEdit(neighbor(playerId, hole, 'prev'));
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault(); commitEdit(neighbor(playerId, hole, 'up'));
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault(); commitEdit(neighbor(playerId, hole, 'down'));
                            }
                          }}
                          className="w-11 h-11 rounded-md text-center text-sm font-mono bg-background ring-2 ring-primary outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          style={score && !score.isPending ? winnerStyle(gp, playerId, hole) : undefined}
                          className={`w-11 h-11 rounded-md text-sm font-mono transition-colors ${
                            score?.isPending
                              ? 'bg-primary/20 ring-1 ring-primary text-primary font-bold'
                              : score
                                ? 'bg-muted hover:bg-accent'
                                : 'text-muted-foreground/30 hover:bg-muted'
                          }`}
                          onClick={() => startEdit(playerId, hole)}
                        >
                          {score?.gross ?? '—'}
                          {score?.isOverride && !score?.isPending && (
                            <span className="text-[hsl(var(--brand-gold))]">*</span>
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 text-center font-mono font-semibold">
                  {sumScores(playerId, holes) || '—'}
                </td>
              </tr>
            );
          })}

          <tr className="border-t border-border bg-muted/20 text-muted-foreground">
            <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1.5 font-medium">Result</td>
            {holes.map(h => (
              <td key={h} className="px-1 py-1.5 text-center text-[10px] leading-tight">
                {shortResult(h) || '—'}
              </td>
            ))}
            <td className="px-2 py-1.5" />
          </tr>
        </tbody>
      </table>
    </div>
  );

  const totalPar = sumPars([...FRONT, ...BACK]);

  return (
    <div className="space-y-4">
      <MatchStatusBar
        leadAmount={0}
        holesPlayed={holesPlayed}
        isComplete={holesPlayed === 18}
        resultLabel={holesPlayed === 0 ? 'Not Started' : `${holesPlayed} holes played`}
        teamA={matchTeams?.[0]}
        teamB={matchTeams?.[1]}
      />


      {pendingEdits.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2 sticky top-14 z-30">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{pendingEdits.size} unsaved</Badge>
            <span className="text-xs text-muted-foreground">Tap a score to edit</span>
          </div>
          <Button size="sm" onClick={handleSaveAll} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save All'}
          </Button>
        </div>
      )}

      {renderNine(FRONT, 'OUT')}
      {renderNine(BACK, 'IN')}

      {/* Totals */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left px-2 py-2 font-semibold">Player</th>
              <th className="px-2 py-2 text-center font-semibold">OUT</th>
              <th className="px-2 py-2 text-center font-semibold">IN</th>
              <th className="px-2 py-2 text-center font-semibold">TOTAL</th>
              {totalPar > 0 && <th className="px-2 py-2 text-center font-semibold">+/-</th>}
            </tr>
          </thead>
          <tbody>
            {orderedPlayers.map((gp: any) => {
              const playerId = gp.tournament_player_id || gp.id;
              const out = sumScores(playerId, FRONT);
              const inn = sumScores(playerId, BACK);
              const tot = out + inn;
              const diff = tot - totalPar;
              return (
                <tr key={gp.id} className="border-t border-border">
                  <td
                    className="px-2 py-1.5 font-medium border-l-4"
                    style={{ borderLeftColor: teamColor(gp) || 'transparent' }}
                  >
                    {gp.display_name || playerId?.slice(0, 6)}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">{out || '—'}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{inn || '—'}</td>
                  <td className="px-2 py-1.5 text-center font-mono font-bold">{tot || '—'}</td>
                  {totalPar > 0 && (
                    <td className="px-2 py-1.5 text-center font-mono">
                      {tot ? (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff) : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HoleResultDots results={holeResultDots} />
    </div>
  );
};

export default GroupScorecardAdmin;
