/**
 * Scoreboard Calculations — Piece 6
 * Pure math helpers for all scoreboard types. No Supabase calls.
 */

// ── TYPES ────────────────────────────────────────────────────

interface HoleResultRow {
  tournament_group_id: string | null;
  /** Set client-side for cross-group match results (group id is null). */
  tournament_round_id?: string | null;
  /** Cross-group match this result belongs to, when applicable. */
  tournament_match_id?: string | null;
  hole_number: number;
  team_points: Record<string, number>;
  player_points: Record<string, number>;
  points_value: number;
  result_label: string | null;
}


interface HoleScoreRow {
  tournament_group_id: string;
  tournament_player_id: string;
  hole_number: number;
  gross_score: number | null;
  is_super_user_override: boolean | null;
}

interface PlayerRow {
  id: string;
  display_name: string;
  handicap_index: number;
  handicap_override: number | null;
  team_id: string | null;
}

interface GroupRow {
  id: string;
  tournament_round_id: string;
  group_number: number;
  status: string;
}

interface GroupPlayerRow {
  tournament_group_id: string;
  tournament_player_id: string;
  team_id: string;
}

interface RoundRow {
  id: string;
  round_number: number;
  status: string;
  course_data: any;
}

interface GameRow {
  id: string;
  tournament_round_id: string;
  game_type: string;
  use_handicaps: boolean | null;
  handicap_allowance_percent: number | null;
}

// ── TEAM TOTALS ──────────────────────────────────────────────

export function calcTeamTotals(
  holeResults: HoleResultRow[],
  teamIds: string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  teamIds.forEach(id => { totals[id] = 0; });
  holeResults.forEach(r => {
    const tp = r.team_points as Record<string, number>;
    if (tp) {
      Object.entries(tp).forEach(([teamId, pts]) => {
        totals[teamId] = (totals[teamId] || 0) + (Number(pts) || 0);
      });
    }
  });
  return totals;
}

// ── TEAM TOTALS PER ROUND ────────────────────────────────────

export function calcTeamTotalsPerRound(
  rounds: RoundRow[],
  groups: Record<string, GroupRow[]>,
  allHoleResults: HoleResultRow[],
  teamIds: string[]
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  rounds.forEach(round => {
    const roundGroupIds = new Set((groups[round.id] || []).map(g => g.id));
    const roundResults = allHoleResults.filter(r =>
      (r.tournament_group_id && roundGroupIds.has(r.tournament_group_id)) ||
      r.tournament_round_id === round.id
    );
    result[round.id] = calcTeamTotals(roundResults, teamIds);
  });
  return result;
}

// ── PER-ROUND TEAM AWARD (scoring method aware) ──────────────

export type TeamScoringMethod = 'cumulative' | 'round_win' | 'custom_pts_per_round';
export type RoundTeamScoringMode = 'per_hole' | 'per_round' | 'per_hole_and_round' | 'fbo' | 'per_match';

export interface RoundTeamScoringPoints {
  round?: number;
  front?: number;
  back?: number;
  overall?: number;
  /** Bonus for winning a whole match (per_match mode). */
  match?: number;
}

const awardSegment = (
  a: number,
  b: number,
  teamAId: string,
  teamBId: string,
  value: number,
  out: Record<string, number>
) => {
  if (a > b) out[teamAId] += value;
  else if (b > a) out[teamBId] += value;
  else { out[teamAId] += value / 2; out[teamBId] += value / 2; }
};

// ── PER-MATCH AWARD (match play, holes up/down) ───────────────

export interface MatchSegmentBreakdown {
  label: string;
  /** Holes won by side A in this segment. */
  holesA: number;
  holesB: number;
  value: number;
  /** Points awarded to each side for this segment. */
  awardA: number;
  awardB: number;
  holesPlayed: number;
}

export interface MatchAwardBreakdown {
  /** Match id for cross-group matches, otherwise the group id. */
  unitId: string;
  isMatch: boolean;
  segments: MatchSegmentBreakdown[];
  awardA: number;
  awardB: number;
}

const segmentAward = (a: number, b: number, value: number): [number, number] =>
  a > b ? [value, 0] : b > a ? [0, value] : [value / 2, value / 2];

/**
 * Scores each match (cross-group match, or foursome group when no matches
 * exist) on its own using match play holes up/down, then sums the points.
 * Hole point values are ignored — only who won each hole matters.
 */
export function calcRoundMatchAward(
  roundHoleResults: HoleResultRow[],
  teamIds: [string, string],
  pts: RoundTeamScoringPoints
): { award: Record<string, number>; matches: MatchAwardBreakdown[] } {
  const [teamAId, teamBId] = teamIds;
  const award: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };

  // Group results by match unit: prefer the cross-group match, else the group.
  const units = new Map<string, { isMatch: boolean; rows: HoleResultRow[] }>();
  roundHoleResults.forEach(r => {
    const matchId = r.tournament_match_id || null;
    const key = matchId || r.tournament_group_id;
    if (!key) return;
    if (!units.has(key)) units.set(key, { isMatch: !!matchId, rows: [] });
    units.get(key)!.rows.push(r);
  });

  const frontPts = pts.front ?? 1;
  const backPts = pts.back ?? 1;
  const overallPts = pts.overall ?? 2;
  const matchPts = pts.match ?? 0;

  const matches: MatchAwardBreakdown[] = [];

  units.forEach((unit, unitId) => {
    // Holes won per side within this match.
    const holesWon = (from: number, to: number) => {
      let a = 0, b = 0, played = 0;
      unit.rows.forEach(r => {
        if (r.hole_number < from || r.hole_number > to) return;
        const tp = (r.team_points || {}) as Record<string, number>;
        const pa = Number(tp[teamAId] || 0);
        const pb = Number(tp[teamBId] || 0);
        played += 1;
        if (pa > pb) a += 1;
        else if (pb > pa) b += 1;
      });
      return { a, b, played };
    };

    const front = holesWon(1, 9);
    const back = holesWon(10, 18);
    const overall = holesWon(1, 99);
    if (overall.played === 0) return;

    const segments: MatchSegmentBreakdown[] = [];
    const push = (label: string, a: number, b: number, value: number, played: number) => {
      const [awardA, awardB] = segmentAward(a, b, value);
      segments.push({ label, holesA: a, holesB: b, value, awardA, awardB, holesPlayed: played });
    };

    if (front.played > 0 && frontPts > 0) push('Front 9', front.a, front.b, frontPts, front.played);
    if (back.played > 0 && backPts > 0) push('Back 9', back.a, back.b, backPts, back.played);
    if (overallPts > 0) push('Overall', overall.a, overall.b, overallPts, overall.played);
    if (matchPts > 0) push('Match win', overall.a, overall.b, matchPts, overall.played);

    const awardA = segments.reduce((s, x) => s + x.awardA, 0);
    const awardB = segments.reduce((s, x) => s + x.awardB, 0);
    award[teamAId] += awardA;
    award[teamBId] += awardB;

    matches.push({ unitId, isMatch: unit.isMatch, segments, awardA, awardB });
  });

  matches.sort((x, y) => x.unitId.localeCompare(y.unitId));
  return { award, matches };
}


/**
 * Points a round contributes to each team's grand total, honoring the
 * tournament scoring method and (for custom points) the round's own mode.
 */
export function calcRoundTeamAward(
  round: any,
  roundTotals: Record<string, number>,
  roundHoleResults: HoleResultRow[],
  teamIds: [string, string],
  method: TeamScoringMethod | undefined,
  customRoundPoints?: number,
  isCompleted?: boolean
): Record<string, number> {
  const [teamAId, teamBId] = teamIds;
  const totalA = roundTotals[teamAId] || 0;
  const totalB = roundTotals[teamBId] || 0;
  const cumulative = { [teamAId]: totalA, [teamBId]: totalB };

  if (method !== 'round_win' && method !== 'custom_pts_per_round') return cumulative;
  const completed = isCompleted ?? round?.status === 'completed';
  if (!completed) return cumulative;

  const out: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };

  if (method === 'round_win') {
    awardSegment(totalA, totalB, teamAId, teamBId, 1, out);
    return out;
  }

  const mode: RoundTeamScoringMode = (round?.team_scoring_mode as RoundTeamScoringMode) || 'per_round';
  const pts: RoundTeamScoringPoints = (round?.team_scoring_points as RoundTeamScoringPoints) || {};

  if (mode === 'per_hole') return cumulative;

  if (mode === 'per_match') {
    return calcRoundMatchAward(roundHoleResults, teamIds, pts).award;
  }


  if (mode === 'per_hole_and_round') {
    out[teamAId] = totalA;
    out[teamBId] = totalB;
    awardSegment(totalA, totalB, teamAId, teamBId, pts.round ?? customRoundPoints ?? 3, out);
    return out;
  }

  if (mode === 'fbo') {
    const sum = (from: number, to: number) => {
      let a = 0, b = 0;
      roundHoleResults.forEach(r => {
        if (r.hole_number >= from && r.hole_number <= to) {
          const tp = (r.team_points || {}) as Record<string, number>;
          a += Number(tp[teamAId] || 0);
          b += Number(tp[teamBId] || 0);
        }
      });
      return [a, b] as const;
    };
    const [frontA, frontB] = sum(1, 9);
    const [backA, backB] = sum(10, 18);
    awardSegment(frontA, frontB, teamAId, teamBId, pts.front ?? 1, out);
    awardSegment(backA, backB, teamAId, teamBId, pts.back ?? 1, out);
    awardSegment(totalA, totalB, teamAId, teamBId, pts.overall ?? 2, out);
    return out;
  }

  awardSegment(totalA, totalB, teamAId, teamBId, pts.round ?? customRoundPoints ?? 3, out);
  return out;
}

// ── INDIVIDUAL GROSS SCORE PER ROUND ────────────────────────

export function calcPlayerGrossPerRound(
  playerId: string,
  roundId: string,
  groups: GroupRow[],
  groupPlayers: Record<string, GroupPlayerRow[]>,
  holeScores: HoleScoreRow[]
): number | null {
  const roundGroups = groups.filter(g => g.tournament_round_id === roundId);
  const group = roundGroups.find(g =>
    (groupPlayers[g.id] || []).some(gp => gp.tournament_player_id === playerId)
  );
  if (!group) return null;

  const playerScores = holeScores.filter(s =>
    s.tournament_group_id === group.id &&
    s.tournament_player_id === playerId &&
    s.gross_score != null
  );
  if (playerScores.length === 0) return null;
  return playerScores.reduce((sum, s) => sum + (s.gross_score || 0), 0);
}

// ── INDIVIDUAL NET SCORE PER ROUND ───────────────────────────

export function calcPlayerNetPerRound(
  player: PlayerRow,
  round: RoundRow,
  game: GameRow | null,
  groups: GroupRow[],
  groupPlayers: Record<string, GroupPlayerRow[]>,
  holeScores: HoleScoreRow[]
): number | null {
  if (!game) return null;
  const roundGroups = groups.filter(g => g.tournament_round_id === round.id);
  const group = roundGroups.find(g =>
    (groupPlayers[g.id] || []).some(gp => gp.tournament_player_id === player.id)
  );
  if (!group) return null;

  const allowancePct = (game.handicap_allowance_percent ?? 100) / 100;
  const effectiveHcp = (player.handicap_override ?? player.handicap_index) * allowancePct;
  const courseHandicap = Math.round(effectiveHcp);

  const holes: { number: number; par: number; handicapIndex: number }[] =
    (round.course_data?.holes || []);

  const playerScores = holeScores.filter(s =>
    s.tournament_group_id === group.id &&
    s.tournament_player_id === player.id &&
    s.gross_score != null
  );
  if (playerScores.length === 0) return null;

  return playerScores.reduce((sum, s) => {
    const hole = holes.find((h: any) => h.number === s.hole_number);
    if (!hole || !s.gross_score) return sum;
    if (courseHandicap <= 0) return sum + s.gross_score;
    const base = Math.floor(courseHandicap / 18);
    const remainder = courseHandicap % 18;
    const strokes = base + (hole.handicapIndex <= remainder ? 1 : 0);
    return sum + (s.gross_score - strokes);
  }, 0);
}

// ── PLAYER POINTS PER ROUND ─────────────────────────────────

export function calcPlayerPointsPerRound(
  playerId: string,
  roundId: string,
  groups: GroupRow[],
  groupPlayers: Record<string, GroupPlayerRow[]>,
  allHoleResults: HoleResultRow[]
): number | null {
  const roundGroups = groups.filter(g => g.tournament_round_id === roundId);
  const group = roundGroups.find(g =>
    (groupPlayers[g.id] || []).some(gp => gp.tournament_player_id === playerId)
  );
  if (!group) return null;

  const results = allHoleResults.filter(r =>
    r.tournament_group_id === group.id ||
    (r.tournament_round_id === roundId && (r.player_points || {})[playerId] !== undefined)
  );
  if (results.length === 0) return null;

  return results.reduce((total, r) => {
    const pp = r.player_points as Record<string, number>;
    return total + (Number(pp?.[playerId]) || 0);
  }, 0);
}

// ── HOLES COMPLETED (THRU) ───────────────────────────────────

export function calcThru(
  playerId: string,
  activeRoundGroups: GroupRow[],
  groupPlayers: Record<string, GroupPlayerRow[]>,
  holeScores: HoleScoreRow[]
): number | 'F' | null {
  const group = activeRoundGroups.find(g =>
    (groupPlayers[g.id] || []).some(gp => gp.tournament_player_id === playerId)
  );
  if (!group) return null;
  if (group.status === 'submitted') return 'F';

  const scores = holeScores.filter(s =>
    s.tournament_group_id === group.id &&
    s.tournament_player_id === playerId &&
    s.gross_score != null
  );
  return scores.length || null;
}

// ── RANKING WITH TIES ─────────────────────────────────────────

export function rankWithTies(
  rows: { id: string; value: number | null }[],
  direction: 'asc' | 'desc'
): { id: string; rank: number; isTied: boolean }[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return direction === 'asc' ? a.value - b.value : b.value - a.value;
  });

  const result: { id: string; rank: number; isTied: boolean }[] = [];
  let currentRank = 1;

  sorted.forEach((row, idx) => {
    if (idx === 0) {
      result.push({ id: row.id, rank: 1, isTied: false });
    } else {
      const prev = sorted[idx - 1];
      if (row.value !== null && row.value === prev.value) {
        result.push({ id: row.id, rank: currentRank, isTied: true });
        result[idx - 1].isTied = true;
      } else {
        currentRank = idx + 1;
        result.push({ id: row.id, rank: currentRank, isTied: false });
      }
    }
  });

  return result;
}

// ── HAS SUPER USER OVERRIDE ──────────────────────────────────

export function playerHasOverride(
  playerId: string,
  holeScores: HoleScoreRow[]
): boolean {
  return holeScores.some(
    s => s.tournament_player_id === playerId && s.is_super_user_override
  );
}

// ── POINTS TO WIN ────────────────────────────────────────────

export function calcPointsToWin(
  rounds: RoundRow[],
  groups: Record<string, GroupRow[]>,
  defaultPointsPerHole: number
): number {
  let totalPossible = 0;
  rounds.forEach(round => {
    const roundGroups = groups[round.id] || [];
    totalPossible += roundGroups.length * 18 * defaultPointsPerHole;
  });
  return totalPossible / 2 + 0.5;
}
