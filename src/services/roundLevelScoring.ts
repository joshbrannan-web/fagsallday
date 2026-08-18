/**
 * Round-level scoring.
 *
 * Some tournament formats are a single team-vs-team match for the WHOLE round,
 * not one match per foursome. Gross Best Ball (6/6/6) is the canonical case: it
 * needs each team's best 2 / 3 / 4 balls for a hole, which is impossible to
 * evaluate fairly inside an uneven foursome (e.g. 3 players from one team and 1
 * from the other).
 *
 * For these formats we pool every player on each team across all groups in the
 * round, run the engine once, and persist the hole results against a single
 * "anchor" group (the lowest group_number in the round) so the existing
 * (tournament_group_id, hole_number) storage, realtime channels and scoreboard
 * readers keep working without double counting.
 */

import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type CourseHole, type RoundResult } from '@/services/tournamentEngine';
import type { TournamentPlayer, TournamentGame, TournamentHolePoints } from '@/types/tournament';

export const ROUND_LEVEL_GAME_TYPES = ['match_play_gross_best_ball', 'blind_gross_best_ball'];

export function isRoundLevelGameType(gameType?: string | null): boolean {
  return !!gameType && ROUND_LEVEL_GAME_TYPES.includes(gameType);
}

export interface RoundLevelContext {
  engineInput: EngineInput;
  anchorGroupId: string;
  groupIds: string[];
  /** Every player in the round, including those without a team assignment. */
  allRoundPlayers: TournamentPlayer[];
}


function mapGame(g: any): TournamentGame {
  return {
    id: g.id,
    tournamentRoundId: g.tournament_round_id,
    gameType: g.game_type,
    defaultPointsPerHole: g.default_points_per_hole,
    halvedHoleRule: g.halved_hole_rule,
    secondBallTiebreaker: g.second_ball_tiebreaker ?? false,
    useHandicaps: g.use_handicaps ?? true,
    handicapAllowancePercent: g.handicap_allowance_percent ?? 100,
    maxScorePerHole: g.max_score_per_hole ?? undefined,
    sixesConfig: g.sixes_config ?? undefined,
    rulesText: g.rules_text ?? undefined,
    sixesFormat: g.sixes_format ?? 'match_play',
    sixesSegmentPoints: g.sixes_segment_points ?? [1, 1, 1],
  } as TournamentGame;
}

/**
 * Build a round-wide engine input: every player on both teams, every score
 * recorded in any group of the round.
 */
export async function buildRoundLevelContext(
  tournamentRoundId: string,
  opts?: { allowAnyGameType?: boolean; isTest?: boolean },
): Promise<RoundLevelContext | null> {
  const isTest = !!opts?.isTest;
  const [roundRes, gameRes, groupsRes] = await Promise.all([
    supabase.from('tournament_rounds').select('id, tournament_id, course_data').eq('id', tournamentRoundId).maybeSingle(),
    supabase.from('tournament_games').select('*').eq('tournament_round_id', tournamentRoundId).maybeSingle(),
    supabase.from('tournament_groups').select('id, group_number').eq('tournament_round_id', tournamentRoundId).eq('is_test', isTest).order('group_number', { ascending: true }),
  ]);

  const round = roundRes.data;
  const gameRow = gameRes.data;
  const groups = groupsRes.data || [];
  if (!round || !gameRow || groups.length === 0) return null;
  if (!opts?.allowAnyGameType && !isRoundLevelGameType(gameRow.game_type)) return null;


  const groupIds = groups.map(g => g.id);

  const [gpRes, playersRes, scoresRes, hpRes, teamsRes] = await Promise.all([
    supabase.from('tournament_group_players').select('tournament_player_id, team_id').in('tournament_group_id', groupIds),
    supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
    supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', groupIds),
    supabase.from('tournament_hole_points').select('*').eq('tournament_game_id', gameRow.id),
    supabase.from('tournament_teams').select('id, name').eq('tournament_id', round.tournament_id),
  ]);

  const allPlayers = playersRes.data || [];
  const gps = gpRes.data || [];

  // Everyone who is playing in this round (in any group).
  const roundPlayerIds = new Set(gps.map(gp => gp.tournament_player_id));

  const teamAssignments: Record<string, string> = {};
  gps.forEach(gp => {
    if (gp.team_id) teamAssignments[gp.tournament_player_id] = gp.team_id;
  });
  // Fallback to the player's tournament team when the group row lacks one.
  allPlayers.forEach(p => {
    if (roundPlayerIds.has(p.id) && !teamAssignments[p.id] && p.team_id) {
      teamAssignments[p.id] = p.team_id;
    }
  });

  const allRoundPlayers: TournamentPlayer[] = allPlayers
    .filter(p => roundPlayerIds.has(p.id))
    .map(p => ({
      id: p.id,
      tournamentId: p.tournament_id,
      userId: p.user_id ?? undefined,
      displayName: p.display_name,
      handicapIndex: p.handicap_index,
      handicapOverride: p.handicap_override ?? undefined,
      teamId: teamAssignments[p.id],
    }));

  const players = allRoundPlayers.filter(p => !!p.teamId);

  if (players.length === 0) return null;


  const scores: Record<string, Record<number, number>> = {};
  (scoresRes.data || []).forEach((s: any) => {
    if (s.gross_score === null || s.gross_score === undefined) return;
    if (!scores[s.tournament_player_id]) scores[s.tournament_player_id] = {};
    scores[s.tournament_player_id][s.hole_number] = s.gross_score;
  });

  const cd = round.course_data as any;
  const courseHoles: CourseHole[] = (cd?.holes || []).map((h: any, i: number) => ({
    number: i + 1,
    par: h.par || 4,
    handicapIndex: h.handicapIndex || (i + 1),
  }));

  const holePointOverrides: TournamentHolePoints[] = (hpRes.data || []).map((hp: any) => ({
    id: hp.id,
    tournamentGameId: hp.tournament_game_id,
    holeNumber: hp.hole_number,
    points: hp.points,
  }));

  const teamNames: Record<string, string> = {};
  (teamsRes.data || []).forEach((t: any) => { teamNames[t.id] = t.name; });

  return {
    anchorGroupId: groups[0].id,
    groupIds,
    allRoundPlayers,

    engineInput: {
      game: mapGame(gameRow),
      holePointOverrides,
      players,
      teamAssignments,
      scores,
      courseHoles,
      teamNames,
    },
  };
}

/**
 * Recalculate a round-level match and persist the results on the anchor group.
 * Results rows belonging to the round's other groups are cleared so team totals
 * are never counted more than once.
 */
export async function recalcRoundLevelResults(
  tournamentRoundId: string,
  opts?: { isTest?: boolean },
): Promise<{ anchorGroupId: string; result: RoundResult } | null> {
  const isTest = !!opts?.isTest;
  const ctx = await buildRoundLevelContext(tournamentRoundId, { isTest });
  if (!ctx) return null;

  let result: RoundResult;
  try {
    result = calcTournamentHoleResults(ctx.engineInput);
  } catch (e) {
    console.error('Round-level engine error', e);
    return null;
  }

  const nonAnchor = ctx.groupIds.filter(id => id !== ctx.anchorGroupId);
  if (nonAnchor.length > 0) {
    await supabase.from('tournament_hole_results').delete().in('tournament_group_id', nonAnchor);
  }

  const payload = result.holeResults.map(hr => ({
    tournament_group_id: ctx.anchorGroupId,
    hole_number: hr.holeNumber,
    team_points: hr.teamPoints,
    player_points: hr.playerPoints,
    points_value: hr.pointsValue,
    result_label: hr.resultLabel,
    is_test: isTest,
    updated_at: new Date().toISOString(),
  }));

  if (payload.length > 0) {
    await supabase
      .from('tournament_hole_results')
      .upsert(payload, { onConflict: 'tournament_group_id,hole_number' });
  }

  // Drop stale anchor rows for holes that are no longer resolvable.
  const validHoles = new Set(result.holeResults.map(hr => hr.holeNumber));
  const { data: existing } = await supabase
    .from('tournament_hole_results')
    .select('id, hole_number')
    .eq('tournament_group_id', ctx.anchorGroupId);
  const stale = (existing || []).filter(r => !validHoles.has(r.hole_number)).map(r => r.id);
  if (stale.length > 0) {
    await supabase.from('tournament_hole_results').delete().in('id', stale);
  }

  return { anchorGroupId: ctx.anchorGroupId, result };
}

// ── CROSS-GROUP ROUND MATCHES ────────────────────────────────
//
// A "round match" defines who plays who for the round (side A vs side B)
// independently of which foursome each player tees off in. This lets a 2v2
// (or 1v1) match be scored correctly when partners/opponents are spread across
// different groups. Results are stored on tournament_hole_results keyed by
// tournament_match_id (tournament_group_id stays NULL).

export interface RoundMatch {
  id: string;
  tournamentRoundId: string;
  matchNumber: number;
  sideA: string[];
  sideB: string[];
  teamAId?: string | null;
  teamBId?: string | null;
}

function mapMatch(row: any): RoundMatch {
  return {
    id: row.id,
    tournamentRoundId: row.tournament_round_id,
    matchNumber: row.match_number,
    sideA: Array.isArray(row.side_a) ? row.side_a : [],
    sideB: Array.isArray(row.side_b) ? row.side_b : [],
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
  };
}

export async function fetchRoundMatches(
  tournamentRoundId: string,
  opts?: { isTest?: boolean },
): Promise<RoundMatch[]> {
  const { data } = await supabase
    .from('tournament_round_matches')
    .select('*')
    .eq('tournament_round_id', tournamentRoundId)
    .eq('is_test', !!opts?.isTest)
    .order('match_number');
  return (data || []).map(mapMatch);
}

export async function fetchRoundMatchesForRounds(roundIds: string[]): Promise<RoundMatch[]> {
  if (roundIds.length === 0) return [];
  const { data } = await supabase
    .from('tournament_round_matches')
    .select('*')
    .in('tournament_round_id', roundIds)
    .eq('is_test', false)
    .order('match_number');
  return (data || []).map(mapMatch);
}

/**
 * Recalculate every defined match for a round from the round-wide score pool
 * and persist the hole results against the match. Group-level result rows for
 * the round are removed so team totals are not counted twice.
 */
export async function recalcRoundMatchResults(
  tournamentRoundId: string,
  opts?: { isTest?: boolean },
): Promise<{ matchId: string; result: RoundResult }[] | null> {
  const isTest = !!opts?.isTest;
  const matches = await fetchRoundMatches(tournamentRoundId, { isTest });
  if (matches.length === 0) return null;

  const ctx = await buildRoundLevelContext(tournamentRoundId, { allowAnyGameType: true, isTest });
  if (!ctx) return null;

  const playerById = new Map(ctx.allRoundPlayers.map(p => [p.id, p]));
  const out: { matchId: string; result: RoundResult }[] = [];

  for (const match of matches) {
    const teamAId = match.teamAId || playerById.get(match.sideA[0])?.teamId || `match-${match.id}-a`;
    const teamBId = match.teamBId || playerById.get(match.sideB[0])?.teamId || `match-${match.id}-b`;
    if (teamAId === teamBId) continue;
    if (match.sideA.length === 0 || match.sideB.length === 0) continue;

    const teamAssignments: Record<string, string> = {};
    match.sideA.forEach(id => { teamAssignments[id] = teamAId; });
    match.sideB.forEach(id => { teamAssignments[id] = teamBId; });

    const players = [...match.sideA, ...match.sideB]
      .map(id => playerById.get(id))
      .filter(Boolean)
      .map(p => ({ ...(p as any), teamId: teamAssignments[(p as any).id] }));
    if (players.length !== match.sideA.length + match.sideB.length) continue;

    const scores: Record<string, Record<number, number>> = {};
    players.forEach(p => {
      if (ctx.engineInput.scores[p.id]) scores[p.id] = ctx.engineInput.scores[p.id];
    });

    let result: RoundResult;
    try {
      result = calcTournamentHoleResults({
        ...ctx.engineInput,
        players,
        teamAssignments,
        scores,
        subMatchups: undefined,
      });
    } catch (e) {
      console.error('Round match engine error', match.id, e);
      continue;
    }

    await supabase.from('tournament_hole_results').delete().eq('tournament_match_id', match.id);

    const payload = result.holeResults.map(hr => ({
      tournament_match_id: match.id,
      tournament_group_id: null,
      hole_number: hr.holeNumber,
      team_points: hr.teamPoints,
      player_points: hr.playerPoints,
      points_value: hr.pointsValue,
      result_label: hr.resultLabel,
      is_test: isTest,
      updated_at: new Date().toISOString(),
    }));
    if (payload.length > 0) {
      await supabase.from('tournament_hole_results').insert(payload as any);
    }

    out.push({ matchId: match.id, result });
  }

  // Group-level rows for this round would double count against match rows.
  if (ctx.groupIds.length > 0) {
    await supabase.from('tournament_hole_results').delete().in('tournament_group_id', ctx.groupIds);
  }

  return out;
}
