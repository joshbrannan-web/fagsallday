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
import { runWithRetry, SubmitError } from '@/services/retry';

// Every read and write below goes through runWithRetry: each request has a time limit,
// connection failures are retried within a time budget, and any failure is thrown
// (SubmitError) instead of being ignored. A failed read stops the calculation before
// anything is saved or deleted.

/** Time budget for a recalculation that isn't part of a round submission. */
export const RECALC_DEADLINE_MS = 10_000;

export interface RecalcOptions {
  isTest?: boolean;
  /** Absolute time (ms) after which no new request is started. Defaults to now + RECALC_DEADLINE_MS. */
  deadline?: number;
}

/**
 * The scoring engine itself failed (a bug, not a connection problem), so retrying won't
 * help. For cross-group matches, results for the other matches were still saved.
 */
export class ResultsCalculationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ResultsCalculationError';
  }
}

const retryBudget = (deadline?: number) => ({ deadline: deadline ?? Date.now() + RECALC_DEADLINE_MS });

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
    stablefordPoints: g.stableford_points ?? undefined,
  } as TournamentGame;
}

/**
 * Build a round-wide engine input: every player on both teams, every score
 * recorded in any group of the round.
 */
export async function buildRoundLevelContext(
  tournamentRoundId: string,
  opts?: { allowAnyGameType?: boolean; isTest?: boolean; deadline?: number },
): Promise<RoundLevelContext | null> {
  const isTest = !!opts?.isTest;
  const retry = retryBudget(opts?.deadline);
  // Any failed read throws here, before anything is calculated, saved or deleted.
  const [round, gameRow, groupsData] = await Promise.all([
    runWithRetry(signal => supabase.from('tournament_rounds').select('id, tournament_id, course_data').eq('id', tournamentRoundId).abortSignal(signal).maybeSingle(), retry),
    runWithRetry(signal => supabase.from('tournament_games').select('*').eq('tournament_round_id', tournamentRoundId).abortSignal(signal).maybeSingle(), retry),
    runWithRetry(signal => supabase.from('tournament_groups').select('id, group_number').eq('tournament_round_id', tournamentRoundId).eq('is_test', isTest).order('group_number', { ascending: true }).abortSignal(signal), retry),
  ]);

  const groups = groupsData || [];
  if (!round || !gameRow || groups.length === 0) return null;
  if (!opts?.allowAnyGameType && !isRoundLevelGameType(gameRow.game_type)) return null;


  const groupIds = groups.map(g => g.id);

  const [gpData, playersData, scoresData, hpData, teamsData] = await Promise.all([
    runWithRetry(signal => supabase.from('tournament_group_players').select('tournament_player_id, team_id').in('tournament_group_id', groupIds).abortSignal(signal), retry),
    runWithRetry(signal => supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id).abortSignal(signal), retry),
    runWithRetry(signal => supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', groupIds).abortSignal(signal), retry),
    runWithRetry(signal => supabase.from('tournament_hole_points').select('*').eq('tournament_game_id', gameRow.id).abortSignal(signal), retry),
    runWithRetry(signal => supabase.from('tournament_teams').select('id, name').eq('tournament_id', round.tournament_id).abortSignal(signal), retry),
  ]);

  const allPlayers = playersData || [];
  const gps = gpData || [];

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
  (scoresData || []).forEach((s: any) => {
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

  const holePointOverrides: TournamentHolePoints[] = (hpData || []).map((hp: any) => ({
    id: hp.id,
    tournamentGameId: hp.tournament_game_id,
    holeNumber: hp.hole_number,
    points: hp.points,
  }));

  const teamNames: Record<string, string> = {};
  (teamsData || []).forEach((t: any) => { teamNames[t.id] = t.name; });

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
 *
 * Order matters: every read must succeed, then the new results are saved (one
 * all-or-nothing request), and only after that are rows for holes that no longer
 * have a result removed. A failure at any step throws and leaves earlier results in place.
 */
export async function recalcRoundLevelResults(
  tournamentRoundId: string,
  opts?: RecalcOptions,
): Promise<{ anchorGroupId: string; result: RoundResult } | null> {
  const isTest = !!opts?.isTest;
  const retry = retryBudget(opts?.deadline);
  const ctx = await buildRoundLevelContext(tournamentRoundId, { isTest, deadline: retry.deadline });
  if (!ctx) return null;
  // A read that succeeds but returns no scores at all must never wipe saved results.
  if (Object.keys(ctx.engineInput.scores).length === 0) return null;

  let result: RoundResult;
  try {
    result = calcTournamentHoleResults(ctx.engineInput);
  } catch (e) {
    console.error('Round-level engine error', e);
    throw new ResultsCalculationError('Round-level results could not be calculated', e);
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

  // 1. Save the new results first.
  if (payload.length > 0) {
    const saved = await runWithRetry(signal => supabase
      .from('tournament_hole_results')
      .upsert(payload, { onConflict: 'tournament_group_id,hole_number' })
      .select('id')
      .abortSignal(signal), retry);
    if ((saved?.length ?? 0) < payload.length) {
      throw new SubmitError('rejected', `Only ${saved?.length ?? 0} of ${payload.length} hole results were saved`);
    }
  }

  // 2. Then drop stale anchor rows for holes that are no longer resolvable.
  const validHoles = new Set(result.holeResults.map(hr => hr.holeNumber));
  const existing = await runWithRetry(signal => supabase
    .from('tournament_hole_results')
    .select('id, hole_number')
    .eq('tournament_group_id', ctx.anchorGroupId)
    .abortSignal(signal), retry);
  const stale = (existing || []).filter(r => !validHoles.has(r.hole_number)).map(r => r.id);
  if (stale.length > 0) {
    await runWithRetry(signal => supabase.from('tournament_hole_results').delete().in('id', stale).abortSignal(signal), retry);
  }

  // 3. Clear rows on the round's other groups so nothing is counted twice.
  const nonAnchor = ctx.groupIds.filter(id => id !== ctx.anchorGroupId);
  if (nonAnchor.length > 0) {
    await runWithRetry(signal => supabase.from('tournament_hole_results').delete().in('tournament_group_id', nonAnchor).abortSignal(signal), retry);
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

/** Like fetchRoundMatches, but a failed read throws instead of looking like "no matches". */
async function fetchRoundMatchesChecked(
  tournamentRoundId: string,
  isTest: boolean,
  retry: { deadline: number },
): Promise<RoundMatch[]> {
  const data = await runWithRetry(signal => supabase
    .from('tournament_round_matches')
    .select('*')
    .eq('tournament_round_id', tournamentRoundId)
    .eq('is_test', isTest)
    .order('match_number')
    .abortSignal(signal), retry);
  return (data || []).map(mapMatch);
}

/**
 * Work out how to replace a match's saved results without ever deleting first:
 * new results reuse the id of the existing row for the same hole (so saving them
 * overwrites it in place), holes without a row get a fresh id, and rows for holes
 * that no longer have a result are returned for deletion afterwards.
 */
export function planResultRewrite<R extends { hole_number: number }>(
  existing: { id: string; hole_number: number }[],
  fresh: R[],
  newId: () => string = () => crypto.randomUUID(),
): { rows: (R & { id: string })[]; staleIds: string[] } {
  const idByHole = new Map<number, string>();
  const staleIds: string[] = [];
  for (const row of existing) {
    if (idByHole.has(row.hole_number)) staleIds.push(row.id); // duplicate for a hole: keep one
    else idByHole.set(row.hole_number, row.id);
  }
  const freshHoles = new Set(fresh.map(r => r.hole_number));
  idByHole.forEach((id, hole) => { if (!freshHoles.has(hole)) staleIds.push(id); });
  const rows = fresh.map(r => ({ ...r, id: idByHole.get(r.hole_number) ?? newId() }));
  return { rows, staleIds };
}

/**
 * Replace one match's saved results. The new rows are saved in a single all-or-nothing
 * request that overwrites existing rows in place, so the match always shows either its
 * complete old results or its complete new ones. Stale rows are deleted only after that
 * save is confirmed.
 */
async function writeMatchResults(
  matchId: string,
  fresh: { hole_number: number }[],
  retry: { deadline: number },
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const existing = await runWithRetry(signal => supabase
      .from('tournament_hole_results')
      .select('id, hole_number')
      .eq('tournament_match_id', matchId)
      .abortSignal(signal), retry);
    const { rows, staleIds } = planResultRewrite(existing || [], fresh);

    try {
      if (rows.length > 0) {
        const saved = await runWithRetry(signal => supabase
          .from('tournament_hole_results')
          .upsert(rows as any, { onConflict: 'id' })
          .select('id')
          .abortSignal(signal), retry);
        if ((saved?.length ?? 0) < rows.length) {
          throw new SubmitError('rejected', `Only ${saved?.length ?? 0} of ${rows.length} match results were saved`);
        }
      }
    } catch (e) {
      // Another device saved results for this match between our read and our save
      // (unique match + hole clash). Nothing was applied; re-read and try once more.
      if (attempt === 0 && e instanceof SubmitError && e.code === '23505') continue;
      throw e;
    }

    if (staleIds.length > 0) {
      await runWithRetry(signal => supabase.from('tournament_hole_results').delete().in('id', staleIds).abortSignal(signal), retry);
    }
    return;
  }
}

/**
 * Holes whose scores are complete but which have no saved result: the sign that a
 * recalculation failed (for example on a player's phone during submission). Covers
 * cross-group match rounds and round-level formats; per-foursome rounds return [].
 */
export function findHolesMissingResults(input: {
  matches: { id: string; sideA: string[]; sideB: string[] }[];
  isRoundLevel: boolean;
  /** The round's groups, lowest group_number (the anchor) first. */
  groupIds: string[];
  roundPlayerIds: string[];
  scores: { tournament_group_id: string; tournament_player_id: string; hole_number: number; gross_score: number | null }[];
  results: { tournament_group_id?: string | null; tournament_match_id?: string | null; hole_number: number }[];
}): number[] {
  const groupSet = new Set(input.groupIds);
  const scored = new Set<string>();
  const holes = new Set<number>();
  input.scores.forEach(s => {
    if (!groupSet.has(s.tournament_group_id) || s.gross_score === null || s.gross_score === undefined) return;
    scored.add(`${s.tournament_player_id}|${s.hole_number}`);
    holes.add(s.hole_number);
  });
  const completeHoles = (players: string[]) =>
    players.length === 0 ? [] : Array.from(holes).filter(h => players.every(p => scored.has(`${p}|${h}`)));

  const missing = new Set<number>();
  if (input.matches.length > 0) {
    for (const m of input.matches) {
      const withResult = new Set(input.results.filter(r => r.tournament_match_id === m.id).map(r => r.hole_number));
      completeHoles([...m.sideA, ...m.sideB]).forEach(h => { if (!withResult.has(h)) missing.add(h); });
    }
  } else if (input.isRoundLevel && input.groupIds.length > 0) {
    const anchor = input.groupIds[0];
    const withResult = new Set(input.results.filter(r => r.tournament_group_id === anchor).map(r => r.hole_number));
    completeHoles(input.roundPlayerIds).forEach(h => { if (!withResult.has(h)) missing.add(h); });
  }
  return Array.from(missing).sort((a, b) => a - b);
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
 *
 * A failed read or save throws (connection or refusal). If the engine fails for some
 * matches, the others are still saved and a ResultsCalculationError is thrown at the end.
 */
export async function recalcRoundMatchResults(
  tournamentRoundId: string,
  opts?: RecalcOptions,
): Promise<{ matchId: string; result: RoundResult }[] | null> {
  const isTest = !!opts?.isTest;
  const retry = retryBudget(opts?.deadline);
  const matches = await fetchRoundMatchesChecked(tournamentRoundId, isTest, retry);
  if (matches.length === 0) return null;

  const ctx = await buildRoundLevelContext(tournamentRoundId, { allowAnyGameType: true, isTest, deadline: retry.deadline });
  if (!ctx) return null;

  const playerById = new Map(ctx.allRoundPlayers.map(p => [p.id, p]));
  const out: { matchId: string; result: RoundResult }[] = [];
  const failedMatches: number[] = [];

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
    // No scores visible for this match: leave its saved results alone rather than wiping them.
    if (Object.keys(scores).length === 0) continue;

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
      failedMatches.push(match.matchNumber);
      continue;
    }

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
    await writeMatchResults(match.id, payload, retry);

    out.push({ matchId: match.id, result });
  }

  // Group-level rows for this round would double count against match rows.
  if (ctx.groupIds.length > 0) {
    await runWithRetry(signal => supabase.from('tournament_hole_results').delete().in('tournament_group_id', ctx.groupIds).abortSignal(signal), retry);
  }

  if (failedMatches.length > 0) {
    throw new ResultsCalculationError(`Results could not be calculated for match ${failedMatches.join(', ')}`);
  }
  return out;
}
