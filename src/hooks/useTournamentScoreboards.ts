import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type CourseHole } from '@/services/tournamentEngine';
import { isRoundLevelGameType, recalcRoundLevelResults, recalcRoundMatchResults, fetchRoundMatchesForRounds, type RoundMatch } from '@/services/roundLevelScoring';

import type { TournamentPlayer, TournamentGame, TournamentHolePoints } from '@/types/tournament';

export const useTournamentScoreboards = (tournamentId: string | undefined) => {
  const [scoreboards, setScoreboards] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [games, setGames] = useState<Record<string, any>>({});
  const [holePoints, setHolePoints] = useState<any[]>([]);
  const [groups, setGroups] = useState<Record<string, any[]>>({});
  const [groupPlayers, setGroupPlayers] = useState<Record<string, any[]>>({});
  const [holeScores, setHoleScores] = useState<any[]>([]);
  const [holeResults, setHoleResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newHoleResult, setNewHoleResult] = useState<any | null>(null);
  const [teamScoringMethod, setTeamScoringMethod] = useState<'cumulative' | 'round_win' | 'custom_pts_per_round'>('cumulative');
  const [customRoundPoints, setCustomRoundPoints] = useState<number>(3);
  const isInitialLoad = useRef(true);
  const allGroupIdsRef = useRef<string[]>([]);
  // Cross-group round matches: results are keyed by match, not by group.
  const [roundMatches, setRoundMatches] = useState<RoundMatch[]>([]);
  const roundMatchesRef = useRef<RoundMatch[]>([]);

  // ── Local snapshot cache (render instantly on revisit) ────────────────
  const cacheKey = tournamentId ? `fg_tournament_scoreboards_${tournamentId}` : null;
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const hydratedRef = useRef(false);

  const writeCache = useCallback((payload: Record<string, any>) => {
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), payload }));
    } catch { /* quota / private mode — cache is best-effort */ }
  }, [cacheKey]);

  useEffect(() => {
    if (!cacheKey || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.payload || Date.now() - (parsed.cachedAt || 0) > CACHE_MAX_AGE_MS) return;
      const p = parsed.payload;
      setScoreboards(p.scoreboards || []);
      setRounds(p.rounds || []);
      setTeams(p.teams || []);
      setPlayers(p.players || []);
      setGames(p.games || {});
      setHolePoints(p.holePoints || []);
      setGroups(p.groups || {});
      setGroupPlayers(p.groupPlayers || {});
      setHoleScores(p.holeScores || []);
      setHoleResults(p.holeResults || []);
      setRoundMatches(p.roundMatches || []);
      roundMatchesRef.current = p.roundMatches || [];
      if (typeof p.teamScoringMethod === 'string') setTeamScoringMethod(p.teamScoringMethod);
      if (typeof p.customRoundPoints === 'number') setCustomRoundPoints(p.customRoundPoints);
      // We have something on screen already — don't block on the network.
      setIsLoading(false);
    } catch { /* corrupt cache — ignore */ }
  }, [cacheKey]);

  // Fetch all core data
  const fetchAll = useCallback(async () => {
    if (!tournamentId) return;

    const [sbRes, rndsRes, teamsRes, playersRes, tRes] = await Promise.all([
      supabase.from('tournament_scoreboards').select('*').eq('tournament_id', tournamentId).order('display_order'),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
      supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('display_order'),
      supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId),
      supabase.from('tournaments').select('team_scoring_method, custom_round_points').eq('id', tournamentId).single(),
    ]);

    const roundsData = rndsRes.data || [];
    const teamsData = teamsRes.data || [];
    const playersData = playersRes.data || [];
    const scoringMethod = ((tRes.data as any)?.team_scoring_method as any) || 'cumulative';
    const roundPts = ((tRes.data as any)?.custom_round_points as number) ?? 3;

    setScoreboards(sbRes.data || []);
    setRounds(roundsData);
    setTeams(teamsData);
    setPlayers(playersData);
    setIsLive(roundsData.some((r: any) => r.status === 'active'));
    setTeamScoringMethod(scoringMethod);
    setCustomRoundPoints(roundPts);

    // Fetch games keyed by round_id
    const roundIds = roundsData.map((r: any) => r.id);
    if (roundIds.length === 0) {
      setIsLoading(false);
      isInitialLoad.current = false;
      return;
    }

    // Wave 2: games, groups and cross-group matches together
    const [gamesRes, groupsRes, matches] = await Promise.all([
      supabase.from('tournament_games').select('*').in('tournament_round_id', roundIds),
      supabase.from('tournament_groups').select('*').in('tournament_round_id', roundIds).eq('is_test', false).order('group_number'),
      fetchRoundMatchesForRounds(roundIds),
    ]);

    const gamesMap: Record<string, any> = {};
    (gamesRes.data || []).forEach((g: any) => { gamesMap[g.tournament_round_id] = g; });
    setGames(gamesMap);

    roundMatchesRef.current = matches;
    setRoundMatches(matches);

    const groupsData = groupsRes.data || [];
    const groupsByRound: Record<string, any[]> = {};
    groupsData.forEach((g: any) => {
      if (!groupsByRound[g.tournament_round_id]) groupsByRound[g.tournament_round_id] = [];
      groupsByRound[g.tournament_round_id].push(g);
    });
    setGroups(groupsByRound);

    const groupIds = groupsData.map((g: any) => g.id);
    if (groupIds.length === 0) {
      setIsLoading(false);
      isInitialLoad.current = false;
      return;
    }

    // Wave 3: group players, hole points, scores and results all at once
    const matchIds = matches.map(m => m.id);
    const [gpRes, hpRes, scoresRes, resultsRes, matchResultsRes] = await Promise.all([
      supabase.from('tournament_group_players').select('*').in('tournament_group_id', groupIds),
      supabase.from('tournament_hole_points').select('*').in('tournament_game_id', (gamesRes.data || []).map((g: any) => g.id)),
      supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', groupIds),
      supabase.from('tournament_hole_results').select('*').in('tournament_group_id', groupIds),
      matchIds.length > 0
        ? supabase.from('tournament_hole_results').select('*').in('tournament_match_id', matchIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const gpMap: Record<string, any[]> = {};
    (gpRes.data || []).forEach((gp: any) => {
      if (!gpMap[gp.tournament_group_id]) gpMap[gp.tournament_group_id] = [];
      gpMap[gp.tournament_group_id].push(gp);
    });
    setGroupPlayers(gpMap);
    const hpData = hpRes.data || [];
    setHolePoints(hpData);

    const matchRoundById: Record<string, string> = {};
    matches.forEach(m => { matchRoundById[m.id] = m.tournamentRoundId; });
    const fetchedScores = scoresRes.data || [];
    const fetchedResults = [
      ...(resultsRes.data || []),
      ...((matchResultsRes.data || []) as any[]).map((r: any) => ({
        ...r,
        tournament_round_id: matchRoundById[r.tournament_match_id],
      })),
    ];
    setHoleScores(fetchedScores);
    setHoleResults(fetchedResults);
    setLastUpdated(new Date());

    // Everything the board needs is on screen now — release the spinner and
    // let any recalculation happen in the background.
    setIsLoading(false);
    isInitialLoad.current = false;

    writeCache({
      scoreboards: sbRes.data || [], rounds: roundsData, teams: teamsData, players: playersData,
      games: gamesMap, holePoints: hpData, groups: groupsByRound, groupPlayers: gpMap,
      holeScores: fetchedScores, holeResults: fetchedResults, roundMatches: matches,
      teamScoringMethod: scoringMethod, customRoundPoints: roundPts,
    });

    void backfillMissingResults(
      fetchedScores, fetchedResults,
      groupsByRound, gamesMap, playersData,
      gpMap, roundsData, hpData, teamsData,
    );
  }, [tournamentId, writeCache]);

  const fetchScoresAndResults = useCallback(async (groupIds: string[]) => {
    if (groupIds.length === 0) return;
    const matchIds = roundMatchesRef.current.map(m => m.id);
    const [scoresRes, resultsRes, matchResultsRes] = await Promise.all([
      supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', groupIds),
      supabase.from('tournament_hole_results').select('*').in('tournament_group_id', groupIds),
      matchIds.length > 0
        ? supabase.from('tournament_hole_results').select('*').in('tournament_match_id', matchIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const fetchedScores = scoresRes.data || [];
    const matchRoundById: Record<string, string> = {};
    roundMatchesRef.current.forEach(m => { matchRoundById[m.id] = m.tournamentRoundId; });
    const fetchedResults = [
      ...(resultsRes.data || []),
      ...((matchResultsRes.data || []) as any[]).map((r: any) => ({
        ...r,
        tournament_round_id: matchRoundById[r.tournament_match_id],
      })),
    ];
    setHoleScores(fetchedScores);
    setHoleResults(fetchedResults);
    setLastUpdated(new Date());
    return { scores: fetchedScores, results: fetchedResults };
  }, []);


  // Backfill missing hole results for groups that have scores but no results
  const backfillMissingResults = useCallback(async (
    fetchedScores: any[],
    fetchedResults: any[],
    allGroups: Record<string, any[]>,
    allGames: Record<string, any>,
    allPlayers: any[],
    allGroupPlayers: Record<string, any[]>,
    allRounds: any[],
    allHolePoints: any[],
    allTeams: any[],
  ) => {
    // ── Cross-group matches ───────────────────────────────────────────────
    // When an admin has defined matches for a round, those matches own the
    // scoring: pool the round's scores, score each match, ignore group rows.
    const matchRoundIds = new Set(roundMatchesRef.current.map(m => m.tournamentRoundId));
    for (const rid of matchRoundIds) {
      const rGroupIds = new Set((allGroups[rid] || []).map((g: any) => g.id));
      const scored = fetchedScores.filter((s: any) => rGroupIds.has(s.tournament_group_id) && s.gross_score !== null);
      if (scored.length === 0) continue;

      const recalced = await recalcRoundMatchResults(rid);
      if (!recalced) continue;

      const rMatchIds = roundMatchesRef.current.filter(m => m.tournamentRoundId === rid).map(m => m.id);
      const { data: refreshed } = await supabase
        .from('tournament_hole_results')
        .select('*')
        .in('tournament_match_id', rMatchIds);
      setHoleResults(prev => [
        ...prev.filter((r: any) => !rMatchIds.includes(r.tournament_match_id) && !rGroupIds.has(r.tournament_group_id)),
        ...((refreshed || []) as any[]).map((r: any) => ({ ...r, tournament_round_id: rid })),
      ]);
      setLastUpdated(new Date());
    }

    // ── Round-level formats (Gross Best Ball 6/6/6) ───────────────────────
    // One team match for the entire round: pool all team members across every
    // foursome, score once, store on the round's anchor group.
    const roundLevelRoundIds = Object.keys(allGroups)
      .filter(rid => !matchRoundIds.has(rid) && isRoundLevelGameType(allGames[rid]?.game_type));
    for (const rid of roundLevelRoundIds) {
      const rGroups = [...(allGroups[rid] || [])].sort((a: any, b: any) => a.group_number - b.group_number);
      const anchorId = rGroups[0]?.id;
      if (!anchorId) continue;
      const rGroupIds = new Set(rGroups.map((g: any) => g.id));

      const roundPlayerIds = new Set(
        rGroups.flatMap((g: any) => (allGroupPlayers[g.id] || []).map((gp: any) => gp.tournament_player_id)),
      );
      if (roundPlayerIds.size === 0) continue;

      const scored = fetchedScores.filter((s: any) => rGroupIds.has(s.tournament_group_id) && s.gross_score !== null);
      if (scored.length === 0) continue;

      const byHole: Record<number, Set<string>> = {};
      scored.forEach((s: any) => {
        if (!byHole[s.hole_number]) byHole[s.hole_number] = new Set();
        byHole[s.hole_number].add(s.tournament_player_id);
      });
      const completeHoles = Object.values(byHole).filter(set => set.size >= roundPlayerIds.size).length;
      const anchorResultHoles = new Set(
        fetchedResults.filter((r: any) => r.tournament_group_id === anchorId).map((r: any) => r.hole_number),
      ).size;
      const hasStrayResults = fetchedResults.some(
        (r: any) => rGroupIds.has(r.tournament_group_id) && r.tournament_group_id !== anchorId,
      );

      if (completeHoles === anchorResultHoles && !hasStrayResults) continue;

      const recalced = await recalcRoundLevelResults(rid);
      if (!recalced) continue;

      const { data: refreshed } = await supabase
        .from('tournament_hole_results')
        .select('*')
        .in('tournament_group_id', Array.from(rGroupIds));
      setHoleResults(prev => [
        ...prev.filter((r: any) => !rGroupIds.has(r.tournament_group_id)),
        ...(refreshed || []),
      ]);
      setLastUpdated(new Date());
    }

    const roundLevelRoundIdSet = new Set(roundLevelRoundIds);
    const allGroupsList = Object.values(allGroups).flat();
    const groupsToBackfill = allGroupsList.filter((g: any) => {
      if (roundLevelRoundIdSet.has(g.tournament_round_id)) return false;
      if (matchRoundIds.has(g.tournament_round_id)) return false;
      const hasScores = fetchedScores.some((s: any) => s.tournament_group_id === g.id && s.gross_score !== null);
      const holesScored = new Set(fetchedScores.filter((s: any) => s.tournament_group_id === g.id && s.gross_score !== null).map((s: any) => s.hole_number));
      const holesWithResults = new Set(fetchedResults.filter((r: any) => r.tournament_group_id === g.id).map((r: any) => r.hole_number));
      return hasScores && holesScored.size > holesWithResults.size;
    });

    if (groupsToBackfill.length === 0) return;



    for (const group of groupsToBackfill) {
      const gameData = allGames[group.tournament_round_id];
      if (!gameData) continue;

      const round = allRounds.find((r: any) => r.id === group.tournament_round_id);
      if (!round) continue;

      const gps = allGroupPlayers[group.id] || [];
      if (gps.length === 0) continue;

      // Build TournamentGame
      const tournamentGame: TournamentGame = {
        id: gameData.id,
        tournamentRoundId: gameData.tournament_round_id,
        gameType: gameData.game_type as any,
        defaultPointsPerHole: gameData.default_points_per_hole,
        halvedHoleRule: gameData.halved_hole_rule as any,
        secondBallTiebreaker: gameData.second_ball_tiebreaker ?? false,
        useHandicaps: gameData.use_handicaps ?? true,
        handicapAllowancePercent: gameData.handicap_allowance_percent ?? 100,
        maxScorePerHole: gameData.max_score_per_hole ?? undefined,
        sixesConfig: gameData.sixes_config as any,
        rulesText: gameData.rules_text ?? undefined,
        sixesFormat: gameData.sixes_format ?? 'match_play',
        sixesSegmentPoints: gameData.sixes_segment_points ?? [1, 1, 1],
      };

      // Build team assignments
      const teamAssignments: Record<string, string> = {};
      gps.forEach((gp: any) => { teamAssignments[gp.tournament_player_id] = gp.team_id; });

      // Build players list (only group players)
      const groupPlayerIds = new Set(gps.map((gp: any) => gp.tournament_player_id));
      const players: TournamentPlayer[] = allPlayers
        .filter((p: any) => groupPlayerIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          tournamentId: p.tournament_id,
          userId: p.user_id ?? undefined,
          displayName: p.display_name,
          handicapIndex: p.handicap_index,
          handicapOverride: p.handicap_override ?? undefined,
          teamId: p.team_id ?? undefined,
        }));

      // Build scores map
      const scoresMap: Record<string, Record<number, number>> = {};
      fetchedScores
        .filter((s: any) => s.tournament_group_id === group.id && s.gross_score !== null)
        .forEach((s: any) => {
          if (!scoresMap[s.tournament_player_id]) scoresMap[s.tournament_player_id] = {};
          scoresMap[s.tournament_player_id][s.hole_number] = s.gross_score;
        });

      // Build course holes
      const cd = round.course_data as any;
      const courseHoles: CourseHole[] = (cd?.holes || []).map((h: any, i: number) => ({
        number: i + 1,
        par: h.par || 4,
        handicapIndex: h.handicapIndex || (i + 1),
      }));

      // Build hole point overrides
      const hpOverrides: TournamentHolePoints[] = allHolePoints
        .filter((hp: any) => hp.tournament_game_id === gameData.id)
        .map((hp: any) => ({
          id: hp.id,
          tournamentGameId: hp.tournament_game_id,
          holeNumber: hp.hole_number,
          points: hp.points,
        }));

      // Build team names
      const teamNames: Record<string, string> = {};
      allTeams.forEach((t: any) => { teamNames[t.id] = t.name; });

      // Extract subMatchups
      const tm = group.team_matchup as any;
      const subMatchups = tm?.subMatchups && Array.isArray(tm.subMatchups) ? tm.subMatchups : undefined;

      try {
        const engineInput: EngineInput = {
          game: tournamentGame,
          holePointOverrides: hpOverrides,
          players,
          teamAssignments,
          scores: scoresMap,
          courseHoles,
          teamNames,
          subMatchups,
        };
        const result = calcTournamentHoleResults(engineInput);

        const upsertPayload = result.holeResults.map(hr => ({
          tournament_group_id: group.id,
          hole_number: hr.holeNumber,
          team_points: hr.teamPoints,
          player_points: hr.playerPoints,
          points_value: hr.pointsValue,
          result_label: hr.resultLabel,
          updated_at: new Date().toISOString(),
        }));

        if (upsertPayload.length > 0) {
          const { data: upserted } = await supabase
            .from('tournament_hole_results')
            .upsert(upsertPayload, { onConflict: 'tournament_group_id,hole_number' })
            .select();

          if (upserted) {
            setHoleResults(prev => {
              const existing = prev.filter((r: any) => r.tournament_group_id !== group.id);
              return [...existing, ...upserted];
            });
            setLastUpdated(new Date());
          }
        }
      } catch (e) {
        console.error('Backfill engine error for group', group.id, e);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Keep group IDs ref in sync
  useEffect(() => {
    allGroupIdsRef.current = Object.values(groups).flat().map((g: any) => g.id);
  }, [groups]);

  // Debounced fetchAll for Realtime callbacks
  const fetchAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchAll = useCallback(() => {
    if (fetchAllTimerRef.current) clearTimeout(fetchAllTimerRef.current);
    fetchAllTimerRef.current = setTimeout(() => fetchAll(), 3000);
  }, [fetchAll]);

  // Realtime subscriptions — per-group filtered channels to avoid receiving database-wide events
  useEffect(() => {
    if (!tournamentId) return;
    const groupIds = allGroupIdsRef.current;
    if (groupIds.length === 0) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // One filtered channel per group for scores + results
    groupIds.forEach(groupId => {
      const channel = supabase
        .channel(`scoreboard-${tournamentId}-${groupId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'tournament_hole_scores',
          filter: `tournament_group_id=eq.${groupId}`,
        }, (payload) => {
          const row = payload.new as any;
          if (payload.eventType === 'DELETE') {
            fetchScoresAndResults(allGroupIdsRef.current);
            return;
          }
          if (row) {
            setHoleScores(prev => {
              const idx = prev.findIndex((s: any) => s.id === row.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
              return [...prev, row];
            });
            setLastUpdated(new Date());
          }
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'tournament_hole_results',
          filter: `tournament_group_id=eq.${groupId}`,
        }, (payload) => {
          const row = payload.new as any;
          if (payload.eventType === 'DELETE') {
            fetchScoresAndResults(allGroupIdsRef.current);
            return;
          }
          if (row) {
            setHoleResults(prev => {
              const idx = prev.findIndex((r: any) => r.id === row.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
              return [...prev, row];
            });
            setLastUpdated(new Date());
            if (!isInitialLoad.current) {
              setNewHoleResult(row);
              setTimeout(() => setNewHoleResult(null), 4500);
            }
          }
        })
        .subscribe();
      channels.push(channel);
    });

    // Separate channel for tournament round status changes (already filtered)
    const roundChannel = supabase
      .channel(`scoreboard-rounds-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_rounds', filter: `tournament_id=eq.${tournamentId}` }, () => {
        debouncedFetchAll();
      })
      .subscribe();
    channels.push(roundChannel);

    return () => {
      if (fetchAllTimerRef.current) clearTimeout(fetchAllTimerRef.current);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [tournamentId, groups, fetchAll, fetchScoresAndResults, debouncedFetchAll]);

  return {
    scoreboards, rounds, teams, players, games, holePoints,
    groups, groupPlayers, holeScores, holeResults, roundMatches,
    isLoading, isLive, lastUpdated, newHoleResult, teamScoringMethod, customRoundPoints,
  };
};
