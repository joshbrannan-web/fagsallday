import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import {
  calcRoundTeamAward,
  calcRoundMatchAward,
  type TeamScoringMethod,
  type RoundTeamScoringMode,
  type RoundTeamScoringPoints,
} from '@/services/scoreboardCalculations';

export interface AwardHoleResult {
  hole_number: number;
  team_points: Record<string, number> | null;
  tournament_group_id?: string | null;
  tournament_match_id?: string | null;
}

interface Props {
  round: any;
  holeResults: AwardHoleResult[];
  teamIds: [string, string];
  teams: Record<string, { name: string; color: string }>;
  method: TeamScoringMethod | undefined;
  customRoundPoints?: number | null;
  courseHoleNumbers?: number[];
  /** Optional display names for match/group units keyed by match id or group id. */
  unitLabels?: Record<string, string>;
}


const fmt = (n: number) => Number(n.toFixed(2));

const TestRoundAwardCard: React.FC<Props> = ({
  round,
  holeResults,
  teamIds,
  teams,
  method,
  customRoundPoints,
  courseHoleNumbers,
  unitLabels,

}) => {
  const [teamAId, teamBId] = teamIds;
  if (!teamAId || !teamBId) return null;

  const mode: RoundTeamScoringMode = (round?.team_scoring_mode as RoundTeamScoringMode) || 'per_round';
  const pts: RoundTeamScoringPoints = (round?.team_scoring_points as RoundTeamScoringPoints) || {};

  if (method !== 'custom_pts_per_round' && method !== 'round_win') return null;

  const nameA = teams[teamAId]?.name || 'Team A';
  const nameB = teams[teamBId]?.name || 'Team B';

  const sum = (from: number, to: number) => {
    let a = 0, b = 0, holes = 0;
    holeResults.forEach(r => {
      if (r.hole_number >= from && r.hole_number <= to) {
        const tp = (r.team_points || {}) as Record<string, number>;
        a += Number(tp[teamAId] || 0);
        b += Number(tp[teamBId] || 0);
        holes += 1;
      }
    });
    return { a, b, holes };
  };

  const played = (from: number, to: number) =>
    (courseHoleNumbers || []).filter(n => n >= from && n <= to).length;

  const totals = sum(1, 99);
  const roundTotals = { [teamAId]: totals.a, [teamBId]: totals.b };

  const award = calcRoundTeamAward(
    round,
    roundTotals,
    holeResults as any,
    teamIds,
    method,
    customRoundPoints ?? undefined,
    true,
  );

  if (mode === 'per_match' && method === 'custom_pts_per_round') {
    const { matches } = calcRoundMatchAward(holeResults as any, teamIds, pts);
    return (
      <Card className="border-[hsl(var(--brand-gold))]/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
              Match Points Award
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" style={teams[teamAId]?.color ? { borderColor: teams[teamAId].color } : undefined}>
                {nameA}: {fmt(award[teamAId] || 0)}
              </Badge>
              <Badge variant="outline" style={teams[teamBId]?.color ? { borderColor: teams[teamBId].color } : undefined}>
                {nameB}: {fmt(award[teamBId] || 0)}
              </Badge>
            </div>
          </div>

          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Results not calculated yet — use Recheck to score the holes already entered.
            </p>
          ) : (
            matches.map((m, idx) => (
              <div key={m.unitId} className="rounded border border-border p-2 space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>{unitLabels?.[m.unitId] || `${m.isMatch ? 'Match' : 'Group'} ${idx + 1}`}</span>
                  <span className="text-muted-foreground">
                    {fmt(m.awardA)} – {fmt(m.awardB)} pts
                  </span>
                </div>
                {m.segments.map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{s.label}</span>
                    <span>holes won {s.holesA} – {s.holesB}</span>
                    <span className="text-right">
                      {s.holesA === s.holesB
                        ? `Halved (${fmt(s.value / 2)} each)`
                        : `${s.holesA > s.holesB ? nameA : nameB} +${fmt(s.value)}`}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}

          <p className="text-[11px] text-muted-foreground">
            Each match is scored on its own with match play holes up/down; every match's points add to the team totals.
          </p>
        </CardContent>
      </Card>
    );
  }


  interface Seg { label: string; a: number; b: number; value: number; complete: boolean }
  const segments: Seg[] = [];

  if (mode === 'fbo') {
    const front = sum(1, 9);
    const back = sum(10, 18);
    const frontHoles = played(1, 9);
    const backHoles = played(10, 18);
    segments.push({ label: 'Front 9', a: front.a, b: front.b, value: pts.front ?? 1, complete: frontHoles === 0 || front.holes >= frontHoles });
    if (backHoles > 0) {
      segments.push({ label: 'Back 9', a: back.a, b: back.b, value: pts.back ?? 1, complete: back.holes >= backHoles });
    }
    segments.push({
      label: 'Overall',
      a: totals.a,
      b: totals.b,
      value: pts.overall ?? 2,
      complete: (courseHoleNumbers?.length ?? 0) === 0 || totals.holes >= (courseHoleNumbers?.length ?? 0),
    });
  } else if (mode === 'per_round' || mode === 'per_hole_and_round') {
    segments.push({
      label: 'Round',
      a: totals.a,
      b: totals.b,
      value: pts.round ?? customRoundPoints ?? 3,
      complete: (courseHoleNumbers?.length ?? 0) === 0 || totals.holes >= (courseHoleNumbers?.length ?? 0),
    });
  } else if (method === 'round_win') {
    segments.push({ label: 'Round win', a: totals.a, b: totals.b, value: 1, complete: true });
  }

  if (segments.length === 0) return null;

  const winnerLabel = (a: number, b: number) => (a > b ? nameA : b > a ? nameB : 'Halved');

  return (
    <Card className="border-[hsl(var(--brand-gold))]/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
            Round Points Award
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" style={teams[teamAId]?.color ? { borderColor: teams[teamAId].color } : undefined}>
              {nameA}: {fmt(award[teamAId] || 0)}
            </Badge>
            <Badge variant="outline" style={teams[teamBId]?.color ? { borderColor: teams[teamBId].color } : undefined}>
              {nameB}: {fmt(award[teamBId] || 0)}
            </Badge>
          </div>
        </div>

        <div className="space-y-1">
          {segments.map(s => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-xs rounded border border-border px-2 py-1.5">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                hole pts {fmt(s.a)} – {fmt(s.b)}
              </span>
              <span className="text-right">
                {s.complete ? (
                  <>
                    {winnerLabel(s.a, s.b)}{' '}
                    <span className="text-muted-foreground">
                      ({s.a === s.b ? `${fmt(s.value / 2)} each` : `+${fmt(s.value)} pts`})
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    {holeResults.length === 0 ? 'not calculated' : 'in progress'}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {holeResults.length === 0
            ? 'No hole results have been calculated for this round yet — use Recheck to score the holes already entered.'
            : 'Hole points decide each segment; the round contributes these points to the tournament standings.'}
        </p>
      </CardContent>
    </Card>
  );
};

export default TestRoundAwardCard;
