import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
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
  onBatchSave: (edits: ScoreEdit[]) => Promise<void>;
}

const GroupScorecardAdmin: React.FC<Props> = ({ groupPlayers, teams, scores, results, onBatchSave }) => {
  const [editCell, setEditCell] = useState<{ playerId: string; hole: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Map<string, ScoreEdit>>(new Map());
  const [saving, setSaving] = useState(false);

  const makeKey = (playerId: string, hole: number) => `${playerId}:${hole}`;

  const getScore = (playerId: string, hole: number) => {
    const key = makeKey(playerId, hole);
    const pending = pendingEdits.get(key);
    if (pending) return { gross: pending.score, isOverride: true, isPending: true };
    const s = scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === hole);
    return s ? { gross: s.gross_score, isOverride: s.is_super_user_override, isPending: false } : null;
  };

  const getResult = (hole: number) => results.find((r: any) => r.hole_number === hole);

  const startEdit = (playerId: string, hole: number) => {
    const key = makeKey(playerId, hole);
    const pending = pendingEdits.get(key);
    const existing = scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === hole);
    const currentValue = pending?.score ?? existing?.gross_score;
    setEditCell({ playerId, hole });
    setEditValue(currentValue?.toString() || '');
  };

  const commitEdit = () => {
    if (!editCell) return;
    const val = parseInt(editValue);
    if (isNaN(val) || val < 1) { setEditCell(null); return; }

    const key = makeKey(editCell.playerId, editCell.hole);
    // Check if it's actually a change from the saved score
    const existing = scores.find((s: any) => s.tournament_player_id === editCell.playerId && s.hole_number === editCell.hole);
    if (existing?.gross_score === val) {
      // Remove from pending if it was there
      setPendingEdits(prev => { const next = new Map(prev); next.delete(key); return next; });
    } else {
      setPendingEdits(prev => new Map(prev).set(key, { playerId: editCell.playerId, hole: editCell.hole, score: val }));
    }
    setEditCell(null);
  };

  const handleSaveAll = async () => {
    if (pendingEdits.size === 0) return;
    setSaving(true);
    try {
      await onBatchSave(Array.from(pendingEdits.values()));
      setPendingEdits(new Map());
      toast.success(`Saved ${pendingEdits.size} score${pendingEdits.size > 1 ? 's' : ''}`);
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

  return (
    <div className="space-y-4">
      <MatchStatusBar
        leadAmount={0}
        holesPlayed={holesPlayed}
        isComplete={holesPlayed === 18}
        resultLabel={holesPlayed === 0 ? 'Not Started' : `${holesPlayed} holes played`}
      />

      {pendingEdits.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{pendingEdits.size} unsaved</Badge>
            <span className="text-xs text-muted-foreground">Click Save to apply changes</span>
          </div>
          <Button size="sm" onClick={handleSaveAll} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save All'}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left p-1.5 font-medium">Hole</th>
              {groupPlayers.map((gp: any) => (
                <th key={gp.id} className="p-1.5 font-medium text-center">{gp.display_name || gp.tournament_player_id?.slice(0, 6)}</th>
              ))}
              <th className="p-1.5 font-medium text-center">Result</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
              const result = getResult(hole);
              return (
                <tr key={hole} className="border-t border-border">
                  <td className="p-1.5 font-medium text-muted-foreground">{hole}</td>
                  {groupPlayers.map((gp: any) => {
                    const playerId = gp.tournament_player_id || gp.id;
                    const score = getScore(playerId, hole);
                    const isEditing = editCell?.playerId === playerId && editCell?.hole === hole;
                    return (
                      <td key={gp.id} className="p-1 text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => e.key === 'Enter' && commitEdit()}
                            className="w-10 h-7 text-xs text-center mx-auto"
                            autoFocus
                            min={1}
                          />
                        ) : (
                          <button
                            className={`w-8 h-7 rounded text-xs font-mono ${
                              score?.isPending
                                ? 'bg-primary/20 ring-1 ring-primary text-primary font-bold'
                                : score
                                  ? 'bg-muted hover:bg-accent'
                                  : 'text-muted-foreground/30 hover:bg-muted'
                            }`}
                            onClick={() => startEdit(playerId, hole)}
                          >
                            {score?.gross ?? '—'}
                            {score?.isOverride && !score?.isPending && <span className="text-[hsl(var(--brand-gold))]">*</span>}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center text-muted-foreground">
                    {result?.result_label || '—'}
                  </td>
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
