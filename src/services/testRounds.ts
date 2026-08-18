import { supabase } from '@/integrations/supabase/client';

/**
 * Test rounds are fully isolated practice copies of a real tournament round.
 *
 * A test mirrors EVERYTHING in the round it was launched from: the same game
 * config (shared, read-only), the same groups/pairings, the same team
 * assignments and leaders, and the same cross-group matches. The clones live in
 * `tournament_groups` / `tournament_round_matches` with `is_test = true` and are
 * excluded from every scoreboard / standings read. Resetting wipes all of the
 * test data so a new test can be run from scratch.
 */

export interface TestGroupSummary {
  id: string;
  group_number: number;
  round_id: string | null;
  status: string;
  players: { tournament_player_id: string; team_id: string; display_name: string }[];
}

export async function fetchTestGroups(tournamentRoundId: string) {
  const { data } = await supabase
    .from('tournament_groups')
    .select('id, group_number, round_id, status')
    .eq('tournament_round_id', tournamentRoundId)
    .eq('is_test', true)
    .order('group_number');
  return data || [];
}

/** Test groups enriched with their player names (for the test console). */
export async function fetchTestGroupSummaries(tournamentRoundId: string): Promise<TestGroupSummary[]> {
  const groups = await fetchTestGroups(tournamentRoundId);
  if (groups.length === 0) return [];
  const ids = groups.map(g => g.id);
  const [gpRes, roundRes] = await Promise.all([
    supabase.from('tournament_group_players').select('*').in('tournament_group_id', ids),
    supabase.from('tournament_rounds').select('tournament_id').eq('id', tournamentRoundId).maybeSingle(),
  ]);
  const { data: players } = await supabase
    .from('tournament_players')
    .select('id, display_name')
    .eq('tournament_id', roundRes.data?.tournament_id || '');
  const nameById = new Map((players || []).map(p => [p.id, p.display_name]));

  return groups.map(g => ({
    ...g,
    players: (gpRes.data || [])
      .filter(gp => gp.tournament_group_id === g.id)
      .map(gp => ({
        tournament_player_id: gp.tournament_player_id,
        team_id: gp.team_id,
        display_name: nameById.get(gp.tournament_player_id) || 'Unknown',
      })),
  }));
}

/** What a test launch would clone — used for the confirmation sheet. */
export async function fetchRoundMirrorPreview(tournamentRoundId: string) {
  const [groupsRes, matchesRes, gameRes] = await Promise.all([
    supabase
      .from('tournament_groups')
      .select('id, group_number, team_matchup, leader_player_id')
      .eq('tournament_round_id', tournamentRoundId)
      .eq('is_test', false)
      .order('group_number'),
    supabase
      .from('tournament_round_matches')
      .select('*')
      .eq('tournament_round_id', tournamentRoundId)
      .eq('is_test', false)
      .order('match_number'),
    supabase
      .from('tournament_games')
      .select('game_type')
      .eq('tournament_round_id', tournamentRoundId)
      .maybeSingle(),
  ]);

  const groups = groupsRes.data || [];
  const groupIds = groups.map(g => g.id);
  const { data: gps } = groupIds.length
    ? await supabase.from('tournament_group_players').select('*').in('tournament_group_id', groupIds)
    : { data: [] as any[] };

  return {
    gameType: gameRes.data?.game_type || null,
    groups,
    groupPlayers: gps || [],
    matches: matchesRes.data || [],
  };
}

/**
 * Clone the round's real setup into an isolated test sandbox and create a
 * practice `rounds` row per test group. Returns the created test groups.
 */
export async function startTestRound(tournamentRoundId: string): Promise<TestGroupSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  // Never stack tests on top of each other.
  await resetTestRound(tournamentRoundId);

  const [roundRes, groupsRes, matchesRes] = await Promise.all([
    supabase
      .from('tournament_rounds')
      .select('id, tournament_id, round_number, name, course_data')
      .eq('id', tournamentRoundId)
      .single(),
    supabase
      .from('tournament_groups')
      .select('*')
      .eq('tournament_round_id', tournamentRoundId)
      .eq('is_test', false)
      .order('group_number'),
    supabase
      .from('tournament_round_matches')
      .select('*')
      .eq('tournament_round_id', tournamentRoundId)
      .eq('is_test', false)
      .order('match_number'),
  ]);

  const round = roundRes.data;
  const realGroups = groupsRes.data || [];
  if (!round) throw new Error('Round not found');
  if (realGroups.length === 0) throw new Error('NO_PAIRINGS');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('id', round.tournament_id)
    .single();

  const realGroupIds = realGroups.map(g => g.id);
  const [gpRes, playersRes] = await Promise.all([
    supabase.from('tournament_group_players').select('*').in('tournament_group_id', realGroupIds),
    supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
  ]);
  const allGroupPlayers = gpRes.data || [];
  const allPlayers = playersRes.data || [];
  const playerById = new Map(allPlayers.map(p => [p.id, p]));

  // 1. Clone groups
  const { data: newGroups, error: groupErr } = await supabase
    .from('tournament_groups')
    .insert(
      realGroups.map(g => ({
        tournament_round_id: tournamentRoundId,
        group_number: g.group_number,
        team_matchup: g.team_matchup as any,
        leader_player_id: g.leader_player_id,
        round_id: null,
        status: 'active',
        is_test: true,
        source_group_id: g.id,
      })) as any,
    )
    .select('id, group_number, source_group_id');
  if (groupErr || !newGroups) throw groupErr || new Error('Failed to clone groups');

  const testGroupBySource = new Map(newGroups.map((g: any) => [g.source_group_id, g.id]));

  // 2. Clone group players
  const gpInserts = allGroupPlayers
    .map(gp => ({
      tournament_group_id: testGroupBySource.get(gp.tournament_group_id),
      tournament_player_id: gp.tournament_player_id,
      team_id: gp.team_id,
    }))
    .filter(gp => !!gp.tournament_group_id);
  if (gpInserts.length > 0) {
    await supabase.from('tournament_group_players').insert(gpInserts as any);
  }

  // 3. Clone cross-group matches (player ids are tournament players — unchanged)
  const matches = matchesRes.data || [];
  if (matches.length > 0) {
    await supabase.from('tournament_round_matches').insert(
      matches.map(m => ({
        tournament_round_id: tournamentRoundId,
        match_number: m.match_number,
        side_a: m.side_a as any,
        side_b: m.side_b as any,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        is_test: true,
        source_match_id: m.id,
      })) as any,
    );
  }

  // 4. Create a practice `rounds` row per test group
  for (const g of newGroups as any[]) {
    const groupPlayerRows = allGroupPlayers.filter(gp => testGroupBySource.get(gp.tournament_group_id) === g.id);
    const players = groupPlayerRows.map((gp, i) => {
      const tp = playerById.get(gp.tournament_player_id);
      const hcp = tp ? (tp.handicap_override ?? tp.handicap_index) : 0;
      return {
        id: (i + 1).toString(),
        name: tp?.display_name || 'Player',
        handicapIndex: hcp,
        courseHandicap: Math.round(hcp),
        tee: 'White',
      };
    });
    const playerMapping = groupPlayerRows.reduce((acc, gp, i) => {
      acc[(i + 1).toString()] = gp.tournament_player_id;
      return acc;
    }, {} as Record<string, string>);

    const teamIds = [...new Set(groupPlayerRows.map(gp => gp.team_id).filter(Boolean))];
    const teamMatchup = teamIds.length === 2 ? { teamAId: teamIds[0], teamBId: teamIds[1] } : null;

    const { data: newRound } = await supabase
      .from('rounds')
      .insert({
        user_id: user.id,
        course_data: round.course_data as any,
        players_data: players as any,
        games_data: [] as any,
        scores: {},
        game_data: {
          _TOURNAMENT_META: {
            tournamentId: round.tournament_id,
            tournamentName: tournament?.name || '',
            roundNumber: round.round_number,
            roundName: round.name || `Round ${round.round_number}`,
            displayName: `TEST — ${tournament?.name || ''} — Round ${round.round_number}`,
            tournamentGroupId: g.id,
            tournamentRoundId: tournamentRoundId,
            playerMapping,
            teamMatchup,
            isTest: true,
          },
        } as any,
        status: 'ACTIVE',
      })
      .select('id')
      .single();

    if (newRound) {
      await supabase.from('tournament_groups').update({ round_id: newRound.id }).eq('id', g.id);
    }
  }

  return fetchTestGroupSummaries(tournamentRoundId);
}

export async function resetTestRound(tournamentRoundId: string): Promise<number> {
  const groups = await fetchTestGroups(tournamentRoundId);

  const { data: testMatches } = await supabase
    .from('tournament_round_matches')
    .select('id')
    .eq('tournament_round_id', tournamentRoundId)
    .eq('is_test', true);
  const matchIds = (testMatches || []).map(m => m.id);

  if (matchIds.length > 0) {
    await supabase.from('tournament_hole_results').delete().in('tournament_match_id', matchIds);
    await supabase.from('tournament_round_matches').delete().in('id', matchIds);
  }

  if (groups.length === 0) return 0;

  const groupIds = groups.map(g => g.id);
  const roundIds = groups.map(g => g.round_id).filter(Boolean) as string[];

  await supabase.from('tournament_hole_scores').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_hole_results').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_group_players').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_groups').delete().in('id', groupIds);

  if (roundIds.length > 0) {
    await supabase.from('round_participants').delete().in('round_id', roundIds);
    await supabase.from('rounds').delete().in('id', roundIds);
  }

  return groups.length;
}

// ── RANDOM SCORE FILL ────────────────────────────────────────
//
// Fills every hole for every player in a test round with plausible random
// gross scores, then runs the exact same scoring path a real round uses
// (cross-group matches → round-level pooled → per-group engine) so the admin
// can verify the round's scoring end to end.

/** Weighted score relative to par: eagle rare, birdie/par/bogey common. */
function randomGross(par: number, courseHandicap: number): number {
  const r = Math.random();
  let delta: number;
  if (r < 0.02) delta = -2;
  else if (r < 0.16) delta = -1;
  else if (r < 0.5) delta = 0;
  else if (r < 0.82) delta = 1;
  else if (r < 0.95) delta = 2;
  else delta = 3;
  // Higher handicaps drift a touch higher.
  if (courseHandicap >= 12 && Math.random() < 0.25) delta += 1;
  return Math.max(1, par + delta);
}

export async function fillTestRoundScores(
  tournamentRoundId: string,
  opts?: { groupId?: string },
): Promise<number> {
  const allGroups = await fetchTestGroups(tournamentRoundId);
  const groups = opts?.groupId ? allGroups.filter(g => g.id === opts.groupId) : allGroups;
  if (groups.length === 0) return 0;

  const { data: round } = await supabase
    .from('tournament_rounds')
    .select('id, tournament_id, course_data')
    .eq('id', tournamentRoundId)
    .maybeSingle();
  if (!round) return 0;

  const cd = round.course_data as any;
  const holes: { number: number; par: number }[] = (cd?.holes || []).map((h: any, i: number) => ({
    number: i + 1,
    par: h?.par || 4,
  }));
  if (holes.length === 0) return 0;

  const groupIds = groups.map(g => g.id);
  const [gpRes, playersRes] = await Promise.all([
    supabase.from('tournament_group_players').select('*').in('tournament_group_id', groupIds),
    supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
  ]);
  const gps = gpRes.data || [];
  const playerById = new Map((playersRes.data || []).map(p => [p.id, p]));

  const payload: any[] = [];
  const scoresByGroup: Record<string, Record<string, Record<number, number>>> = {};

  gps.forEach(gp => {
    const tp = playerById.get(gp.tournament_player_id);
    const hcp = Math.round((tp?.handicap_override ?? tp?.handicap_index ?? 0) as number);
    holes.forEach(h => {
      const gross = randomGross(h.par, hcp);
      payload.push({
        tournament_group_id: gp.tournament_group_id,
        tournament_player_id: gp.tournament_player_id,
        hole_number: h.number,
        gross_score: gross,
        is_super_user_override: false,
      });
      if (!scoresByGroup[gp.tournament_group_id]) scoresByGroup[gp.tournament_group_id] = {};
      const g = scoresByGroup[gp.tournament_group_id];
      if (!g[gp.tournament_player_id]) g[gp.tournament_player_id] = {};
      g[gp.tournament_player_id][h.number] = gross;
    });
  });

  if (payload.length === 0) return 0;

  const { error } = await supabase
    .from('tournament_hole_scores')
    .upsert(payload, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' });
  if (error) throw error;

  // Mirror the scores into each test group's practice `rounds` row so the
  // scorecards show the same numbers.
  for (const g of groups) {
    if (!g.round_id) continue;
    const { data: r } = await supabase
      .from('rounds')
      .select('id, game_data, scores')
      .eq('id', g.round_id)
      .maybeSingle();
    if (!r) continue;
    const meta = (r.game_data as any)?._TOURNAMENT_META;
    const mapping: Record<string, string> = meta?.playerMapping || {};
    const localByTournamentId: Record<string, string> = {};
    Object.entries(mapping).forEach(([localId, tpId]) => { localByTournamentId[tpId as string] = localId; });

    const blob: Record<number, Record<string, number>> = {};
    Object.entries(scoresByGroup[g.id] || {}).forEach(([tpId, byHole]) => {
      const localId = localByTournamentId[tpId];
      if (!localId) return;
      Object.entries(byHole).forEach(([holeStr, score]) => {
        const hole = Number(holeStr);
        if (!blob[hole]) blob[hole] = {};
        blob[hole][localId] = score;
      });
    });

    await supabase.from('rounds').update({ scores: blob as any }).eq('id', g.round_id);
  }

  await recalcTestRoundResults(tournamentRoundId);

  return payload.length;
}

/** Recompute every test result for a round using the round's real scoring path. */
export async function recalcTestRoundResults(tournamentRoundId: string): Promise<void> {
  const matches = await fetchRoundMatches(tournamentRoundId, { isTest: true });
  if (matches.length > 0) {
    await recalcRoundMatchResults(tournamentRoundId, { isTest: true });
    return;
  }

  const { data: game } = await supabase
    .from('tournament_games')
    .select('game_type')
    .eq('tournament_round_id', tournamentRoundId)
    .maybeSingle();

  if (isRoundLevelGameType(game?.game_type)) {
    await recalcRoundLevelResults(tournamentRoundId, { isTest: true });
    return;
  }

  // Per-group formats: run the engine once per test group.
  const ctx = await buildRoundLevelContext(tournamentRoundId, { allowAnyGameType: true, isTest: true });
  if (!ctx) return;

  const groups = await fetchTestGroups(tournamentRoundId);
  const { data: gps } = await supabase
    .from('tournament_group_players')
    .select('tournament_group_id, tournament_player_id')
    .in('tournament_group_id', groups.map(g => g.id));

  const playerById = new Map(ctx.allRoundPlayers.map(p => [p.id, p]));

  for (const g of groups) {
    const ids = (gps || []).filter(x => x.tournament_group_id === g.id).map(x => x.tournament_player_id);
    const players = ids.map(id => playerById.get(id)).filter(Boolean) as any[];
    if (players.length === 0) continue;

    const teamAssignments: Record<string, string> = {};
    players.forEach(p => { if (p.teamId) teamAssignments[p.id] = p.teamId; });

    const scores: Record<string, Record<number, number>> = {};
    players.forEach(p => { if (ctx.engineInput.scores[p.id]) scores[p.id] = ctx.engineInput.scores[p.id]; });

    let result;
    try {
      result = calcTournamentHoleResults({
        ...ctx.engineInput,
        players: players.filter(p => !!p.teamId),
        teamAssignments,
        scores,
      });
    } catch (e) {
      console.error('Test round engine error', g.id, e);
      continue;
    }

    await supabase.from('tournament_hole_results').delete().eq('tournament_group_id', g.id);

    const resultPayload = result.holeResults
      .filter(hr => hr.resultLabel !== undefined)
      .map(hr => ({
        tournament_group_id: g.id,
        hole_number: hr.holeNumber,
        team_points: hr.teamPoints,
        player_points: hr.playerPoints,
        points_value: hr.pointsValue,
        result_label: hr.resultLabel,
        is_test: true,
        updated_at: new Date().toISOString(),
      }));
    if (resultPayload.length > 0) {
      await supabase.from('tournament_hole_results').insert(resultPayload as any);
    }
  }
}
