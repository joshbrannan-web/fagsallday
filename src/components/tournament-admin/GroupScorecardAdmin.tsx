import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import MatchStatusBar from './MatchStatusBar';
import HoleResultDots from './HoleResultDots';

interface Props {
  groupPlayers: any[];
  teams: any[];
  scores: any[];
  results: any[];
  onOverrideScore: (playerId: string, holeNumber: number, grossScore: number) => Promise<void>;
}

const GroupScorecardAdmin: React.FC<Props> = ({ groupPlayers, teams, scores, results, onOverrideScore }) => {
  const [editCell, setEditCell] = useState<{ playerId: string; hole: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const getScore = (playerId: string, hole: number) => {
    const s = scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === hole);
    return s ? { gross: s.gross_score, isOverride: s.is_super_user_override } : null;
  };

  const getResult = (hole: number) => results.find((r: any) => r.hole_number === hole);

  const startEdit = (playerId: string, hole: number) => {
    const existing = getScore(playerId, hole);
    setEditCell({ playerId, hole });
    setEditValue(existing?.gross?.toString() || '');
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const val = parseInt(editValue);
    if (isNaN(val) || val < 1) return;
    await onOverrideScore(editCell.playerId, editCell.hole, val);
    setEditCell(null);
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
                            onBlur={saveEdit}
                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            className="w-10 h-7 text-xs text-center mx-auto"
                            autoFocus
                            min={1}
                          />
                        ) : (
                          <button
                            className={`w-8 h-7 rounded text-xs font-mono ${score ? 'bg-muted hover:bg-accent' : 'text-muted-foreground/30 hover:bg-muted'}`}
                            onClick={() => startEdit(playerId, hole)}
                          >
                            {score?.gross ?? '—'}
                            {score?.isOverride && <span className="text-[hsl(var(--brand-gold))]">*</span>}
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
