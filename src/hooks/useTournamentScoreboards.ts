import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type CourseHole } from '@/services/tournamentEngine';
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

  // Fetch all core data
  const fetchAll = useCallback(async () => {
    if (!tournamentId) return;
    setIsLoading(true);

    const [sbRes, rndsRes, teamsRes, playersRes, tRes] = await Promise.all([
      supabase.from('tournament_scoreboards').select('*').eq('tournament_id', tournamentId).order('display_order'),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
      supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('display_order'),
      supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId),
      supabase.from('tournaments').select('team_scoring_method').eq('id', tournamentId).single(),
    ]);

    const roundsData = rndsRes.data || [];
    setScoreboards(sbRes.data || []);
    setRounds(roundsData);
    setTeams(teamsRes.data || []);
    setPlayers(playersRes.data || []);
    setIsLive(roundsData.some((r: any) => r.status === 'active'));
    setTeamScoringMethod(((tRes.data as any)?.team_scoring_method as any) || 'cumulative');
    setCustomRoundPoints(((tRes.data as any)?.custom_round_points as number) ?? 3);

    // Fetch games keyed by round_id
    const roundIds = roundsData.map((r: any) => r.id);
    if (roundIds.length > 0) {
      const [gamesRes, groupsRes] = await Promise.all([
        supabase.from('tournament_games').select('*').in('tournament_round_id', roundIds),
        supabase.from('tournament_groups').select('*').in('tournament_round_id', roundIds).order('group_number'),
      ]);

      const gamesMap: Record<string, any> = {};
      (gamesRes.data || []).forEach((g: any) => { gamesMap[g.tournament_round_id] = g; });
      setGames(gamesMap);

      const groupsData = groupsRes.data || [];
      const groupsByRound: Record<string, any[]> = {};
      groupsData.forEach((g: any) => {
        if (!groupsByRound[g.tournament_round_id]) groupsByRound[g.tournament_round_id] = [];
        groupsByRound[g.tournament_round_id].push(g);
      });
      setGroups(groupsByRound);

      const groupIds = groupsData.map((g: any) => g.id);
      if (groupIds.length > 0) {
        const [gpRes, hpRes] = await Promise.all([
          supabase.from('tournament_group_players').select('*').in('tournament_group_id', groupIds),
          supabase.from('tournament_hole_points').select('*').in('tournament_game_id', (gamesRes.data || []).map((g: any) => g.id)),
        ]);

        const gpMap: Record<string, any[]> = {};
        (gpRes.data || []).forEach((gp: any) => {
          if (!gpMap[gp.tournament_group_id]) gpMap[gp.tournament_group_id] = [];
          gpMap[gp.tournament_group_id].push(gp);
        });
        setGroupPlayers(gpMap);
        const hpData = hpRes.data || [];
        setHolePoints(hpData);

        // Fetch scores and results, then backfill missing results
        const fetched = await fetchScoresAndResults(groupIds);
        if (fetched) {
          await backfillMissingResults(
            fetched.scores, fetched.results,
            groupsByRound, gamesMap, playersRes.data || [],
            gpMap, roundsData, hpData, teamsRes.data || [],
          );
        }
      }
    }

    setIsLoading(false);
    isInitialLoad.current = false;
  }, [tournamentId]);

  const fetchScoresAndResults = useCallback(async (groupIds: string[]) => {
    if (groupIds.length === 0) return;
    const [scoresRes, resultsRes] = await Promise.all([
      supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', groupIds),
      supabase.from('tournament_hole_results').select('*').in('tournament_group_id', groupIds),
    ]);
    const fetchedScores = scoresRes.data || [];
    const fetchedResults = resultsRes.data || [];
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
    const allGroupsList = Object.values(allGroups).flat();
    const groupsToBackfill = allGroupsList.filter((g: any) => {
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

  // Realtime subscriptions
  useEffect(() => {
    if (!tournamentId) return;

    const allGroupIds = Object.values(groups).flat().map((g: any) => g.id);
    if (allGroupIds.length === 0) return;

    const channel = supabase
      .channel(`scoreboards-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_scores' }, (payload) => {
        const row = payload.new as any;
        if (payload.eventType === 'DELETE') {
          fetchScoresAndResults(allGroupIds);
          return;
        }
        if (row && allGroupIds.includes(row.tournament_group_id)) {
          setHoleScores(prev => {
            const idx = prev.findIndex((s: any) => s.id === row.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
            return [...prev, row];
          });
          setLastUpdated(new Date());
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_results' }, (payload) => {
        const row = payload.new as any;
        if (payload.eventType === 'DELETE') {
          fetchScoresAndResults(allGroupIds);
          return;
        }
        if (row && allGroupIds.includes(row.tournament_group_id)) {
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_rounds', filter: `tournament_id=eq.${tournamentId}` }, () => {
        fetchAll();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, groups, fetchAll, fetchScoresAndResults]);

  return {
    scoreboards, rounds, teams, players, games, holePoints,
    groups, groupPlayers, holeScores, holeResults,
    isLoading, isLive, lastUpdated, newHoleResult, teamScoringMethod, customRoundPoints,
  };
};
