import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type RoundResult, type CourseHole } from '@/services/tournamentEngine';
import { isRoundLevelGameType, buildRoundLevelContext, recalcRoundLevelResults, fetchRoundMatches, recalcRoundMatchResults } from '@/services/roundLevelScoring';

import type { TournamentPlayer, TournamentGame, TournamentHolePoints, MatchState } from '@/types/tournament';
import { offlineStorage } from '@/services/offlineStorage';

export interface SegmentTotal {
  teamSums: Record<string, number>;
  holesComplete: number;
  totalHoles: number;
  pointsAvailable: number;
  isComplete: boolean;
  winnerTeamId?: string;
  label: string;
}

interface OverlayState {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string; grossScores?: Record<string, number>; netScores?: Record<string, number>; playerPoints?: Record<string, number>; pointsValue?: number }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
  matchState?: MatchState;
}

export interface NewHoleEvent {
  holeNumber: number;
  resultLabel: string;
  teamPoints: Record<string, number>;
  winnerTeamId?: string;
  pointsValue: number;
}

export const useTournamentOverlay = (
  tournamentGroupId: string | undefined,
  tournamentName?: string,
  roundName?: string,
  playerMapping?: Record<string, string>,
  teamMatchup?: { teamAId: string; teamBId: string } | null,
  isReadOnly?: boolean,
) => {
  const [state, setState] = useState<OverlayState>({
    tournamentName: tournamentName || '',
    roundName: roundName || '',
    teamMatchup: teamMatchup || null,
    teams: {},
    holeResults: {},
    teamTotals: {},
    holesPlayed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [tournamentGame, setTournamentGame] = useState<TournamentGame | null>(null);
  const [holePointOverrides, setHolePointOverrides] = useState<TournamentHolePoints[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({});
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [allHoleScores, setAllHoleScores] = useState<Record<string, Record<number, number>>>({});
  const [subMatchups, setSubMatchups] = useState<{ playerA: string; playerB: string }[] | undefined>(undefined);
  

  // Dirty-hole tracking for per-hole sync
  const syncedHolesRef = useRef<Set<number>>(new Set());
  const dirtyHolesRef = useRef<Set<number>>(new Set());

  // Animation trigger
  const previousHoleCount = useRef(0);
  const [newlyCompletedHole, setNewlyCompletedHole] = useState<NewHoleEvent | null>(null);

  // Stable refs for reload to avoid stale closures
  const tournamentGameRef = useRef<TournamentGame | null>(null);
  const holePointOverridesRef = useRef<TournamentHolePoints[]>([]);
  const tournamentPlayersRef = useRef<TournamentPlayer[]>([]);
  const teamAssignmentsRef = useRef<Record<string, string>>({});
  const courseHolesRef = useRef<CourseHole[]>([]);
  const subMatchupsRef = useRef<{ playerA: string; playerB: string }[] | undefined>(undefined);
  // Cross-group matches: this round is scored per match, not per foursome.
  const hasRoundMatchesRef = useRef(false);
  // Test rounds are isolated: never pooled with real round/match scoring.
  const isTestGroupRef = useRef(false);

  useEffect(() => {
    const roundId = tournamentGame?.tournamentRoundId;
    if (!roundId || isTestGroupRef.current) { hasRoundMatchesRef.current = false; return; }
    let cancelled = false;
    fetchRoundMatches(roundId).then(m => { if (!cancelled) hasRoundMatchesRef.current = m.length > 0; });
    return () => { cancelled = true; };
  }, [tournamentGame?.tournamentRoundId]);

  /**
   * For round-level formats (Gross Best Ball 6/6/6) the match is one team-vs-team
   * contest across the whole round, so the engine must see every team member in
   * the round — not just this foursome. Local (possibly unsynced) group scores
   * are layered on top of the round-wide scores from the database.
   */
  const withRoundLevelInput = async (base: EngineInput): Promise<EngineInput> => {
    if (isTestGroupRef.current) return base;
    if (!isRoundLevelGameType(base.game.gameType) || !base.game.tournamentRoundId) return base;
    try {
      const ctx = await buildRoundLevelContext(base.game.tournamentRoundId);
      if (!ctx) return base;
      const scores: Record<string, Record<number, number>> = {};
      Object.entries(ctx.engineInput.scores).forEach(([pid, holes]) => { scores[pid] = { ...holes }; });
      Object.entries(base.scores).forEach(([pid, holes]) => {
        scores[pid] = { ...(scores[pid] || {}), ...holes };
      });
      return {
        ...ctx.engineInput,
        scores,
        teamNames: base.teamNames ?? ctx.engineInput.teamNames,
      };
    } catch (e) {
      console.error('Round-level input build failed, falling back to group scoring', e);
      return base;
    }
  };

  // Reload function: fetches latest scores + results and re-runs engine

  const reload = useCallback(async () => {
    if (!tournamentGroupId) return;

    const game = tournamentGameRef.current;
    const players = tournamentPlayersRef.current;
    const assignments = teamAssignmentsRef.current;
    const holes = courseHolesRef.current;
    const overrides = holePointOverridesRef.current;

    if (!game || players.length === 0 || holes.length === 0) return;

    const { data: scoresData } = await supabase
      .from('tournament_hole_scores')
      .select('*')
      .eq('tournament_group_id', tournamentGroupId);

    const scoresMap: Record<string, Record<number, number>> = {};
    (scoresData || []).forEach(s => {
      if (s.gross_score !== null) {
        if (!scoresMap[s.tournament_player_id]) scoresMap[s.tournament_player_id] = {};
        scoresMap[s.tournament_player_id][s.hole_number] = s.gross_score;
      }
    });
    setAllHoleScores(scoresMap);

    try {
      const teamNameMap: Record<string, string> = {};
      Object.entries(state.teams).forEach(([id, t]) => { teamNameMap[id] = t.name; });

      const engineInput: EngineInput = {
        game, holePointOverrides: overrides, players, teamAssignments: assignments,
        scores: scoresMap, courseHoles: holes, teamNames: teamNameMap,
        subMatchups: subMatchupsRef.current,
      };
      const result = calcTournamentHoleResults(await withRoundLevelInput(engineInput));


      const newHoleResults: Record<number, any> = {};
      const newTeamTotals: Record<string, number> = {};
      result.holeResults.forEach(hr => {
        newHoleResults[hr.holeNumber] = {
          teamPoints: hr.teamPoints, resultLabel: hr.resultLabel,
          grossScores: hr.grossScores, netScores: hr.netScores,
          playerPoints: hr.playerPoints, pointsValue: hr.pointsValue,
        };
        Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
          newTeamTotals[tid] = (newTeamTotals[tid] || 0) + pts;
        });
      });

      // Detect newly completed hole for animation (#59 fix: include halved no-points)
      const completedHoles = result.holeResults.filter(hr => hr.resultLabel && hr.resultLabel !== '');
      if (completedHoles.length > previousHoleCount.current) {
        const newest = completedHoles[completedHoles.length - 1];
        const winnerTeamId = Object.entries(newest.teamPoints)
          .sort((a, b) => b[1] - a[1])[0];
        setNewlyCompletedHole({
          holeNumber: newest.holeNumber,
          resultLabel: newest.resultLabel,
          teamPoints: newest.teamPoints,
          winnerTeamId: winnerTeamId[1] > 0 ? winnerTeamId[0] : undefined,
          pointsValue: newest.pointsValue,
        });
        previousHoleCount.current = completedHoles.length;
        setTimeout(() => setNewlyCompletedHole(null), 2500);
      }

      setState(prev => ({
        ...prev,
        holeResults: newHoleResults,
        teamTotals: newTeamTotals,
        holesPlayed: result.holeResults.length,
        matchState: result.matchState,
      }));

      // Results are computed locally only — no DB writes during play
      // batchSyncAllScores() handles persisting on round completion
    } catch (e) {
      console.error('Tournament engine error:', e);
    }
  }, [tournamentGroupId, state.teams]);

  // Initial load
  useEffect(() => {
    if (!tournamentGroupId) { setIsLoading(false); return; }
    const load = async () => {
      setIsLoading(true);

      const { data: group } = await supabase
        .from('tournament_groups')
        .select('tournament_round_id, team_matchup, is_test')
        .eq('id', tournamentGroupId)
        .single();

      if (!group) { setIsLoading(false); return; }

      isTestGroupRef.current = !!(group as any).is_test;

      // Extract subMatchups from team_matchup JSONB
      const tm = group.team_matchup as any;
      const extractedSubMatchups: { playerA: string; playerB: string }[] | undefined =
        tm?.subMatchups && Array.isArray(tm.subMatchups) ? tm.subMatchups : undefined;
      setSubMatchups(extractedSubMatchups);
      subMatchupsRef.current = extractedSubMatchups;

      const { data: round } = await supabase
        .from('tournament_rounds')
        .select('tournament_id, course_data')
        .eq('id', group.tournament_round_id)
        .single();

      if (!round) { setIsLoading(false); return; }

      const [teamsRes, gameRes, groupPlayersRes, playersRes, scoresRes, holePointsRes] = await Promise.all([
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_games').select('*').eq('tournament_round_id', group.tournament_round_id).single(),
        supabase.from('tournament_group_players').select('tournament_player_id, team_id').eq('tournament_group_id', tournamentGroupId),
        supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_hole_scores').select('*').eq('tournament_group_id', tournamentGroupId),
        supabase.from('tournament_hole_points').select('*, tournament_games!inner(tournament_round_id)').eq('tournament_games.tournament_round_id', group.tournament_round_id),
      ]);

      const teamsMap: Record<string, { name: string; color: string }> = {};
      (teamsRes.data || []).forEach(t => { teamsMap[t.id] = { name: t.name, color: t.color }; });

      let game: TournamentGame | null = null;
      let overrides: TournamentHolePoints[] = [];
      if (gameRes.data) {
        const g = gameRes.data;
        game = {
          id: g.id,
          tournamentRoundId: g.tournament_round_id,
          gameType: g.game_type as any,
          defaultPointsPerHole: g.default_points_per_hole,
          halvedHoleRule: g.halved_hole_rule as any,
          secondBallTiebreaker: g.second_ball_tiebreaker ?? false,
          useHandicaps: g.use_handicaps ?? true,
          handicapAllowancePercent: g.handicap_allowance_percent ?? 100,
          maxScorePerHole: g.max_score_per_hole ?? undefined,
          sixesConfig: g.sixes_config as any,
          rulesText: g.rules_text ?? undefined,
          sixesFormat: (g as any).sixes_format ?? 'match_play',
          sixesSegmentPoints: (g as any).sixes_segment_points ?? [1, 1, 1],
        };
        setTournamentGame(game);
        tournamentGameRef.current = game;

        overrides = (holePointsRes.data || [])
          .filter(hp => hp.tournament_game_id === g.id)
          .map(hp => ({
            id: hp.id,
            tournamentGameId: hp.tournament_game_id,
            holeNumber: hp.hole_number,
            points: hp.points,
          }));
        setHolePointOverrides(overrides);
        holePointOverridesRef.current = overrides;
      }

      const assignments: Record<string, string> = {};
      (groupPlayersRes.data || []).forEach(gp => {
        assignments[gp.tournament_player_id] = gp.team_id;
      });
      setTeamAssignments(assignments);
      teamAssignmentsRef.current = assignments;

      const groupPlayerIds = new Set((groupPlayersRes.data || []).map(gp => gp.tournament_player_id));
      const groupTournamentPlayers: TournamentPlayer[] = (playersRes.data || [])
        .filter(p => groupPlayerIds.has(p.id))
        .map(p => ({
          id: p.id,
          tournamentId: p.tournament_id,
          userId: p.user_id ?? undefined,
          displayName: p.display_name,
          handicapIndex: p.handicap_index,
          handicapOverride: p.handicap_override ?? undefined,
          teamId: p.team_id ?? undefined,
        }));
      setTournamentPlayers(groupTournamentPlayers);
      tournamentPlayersRef.current = groupTournamentPlayers;

      const cd = round.course_data as any;
      const holes: CourseHole[] = (cd?.holes || []).map((h: any, i: number) => ({
        number: i + 1,
        par: h.par || 4,
        handicapIndex: h.handicapIndex || (i + 1),
      }));
      setCourseHoles(holes);
      courseHolesRef.current = holes;

      const scoresMap: Record<string, Record<number, number>> = {};
      (scoresRes.data || []).forEach(s => {
        if (s.gross_score !== null) {
          if (!scoresMap[s.tournament_player_id]) scoresMap[s.tournament_player_id] = {};
          scoresMap[s.tournament_player_id][s.hole_number] = s.gross_score;
        }
      });
      setAllHoleScores(scoresMap);

      // Run engine for initial state
      if (game && groupTournamentPlayers.length > 0 && holes.length > 0) {
        try {
      const teamNameMap: Record<string, string> = {};
      Object.entries(teamsMap).forEach(([id, t]) => { teamNameMap[id] = t.name; });

      const engineInput: EngineInput = {
        game, holePointOverrides: overrides, players: groupTournamentPlayers,
        teamAssignments: assignments, scores: scoresMap, courseHoles: holes,
        teamNames: teamNameMap, subMatchups: extractedSubMatchups,
      };
          const result = calcTournamentHoleResults(await withRoundLevelInput(engineInput));


          const holeResults: Record<number, any> = {};
          const teamTotals: Record<string, number> = {};
          result.holeResults.forEach(hr => {
            holeResults[hr.holeNumber] = {
              teamPoints: hr.teamPoints, resultLabel: hr.resultLabel,
              grossScores: hr.grossScores, netScores: hr.netScores,
              playerPoints: hr.playerPoints, pointsValue: hr.pointsValue,
            };
            Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
              teamTotals[tid] = (teamTotals[tid] || 0) + pts;
            });
          });

          const completedHoles = result.holeResults.filter(hr => hr.resultLabel && hr.resultLabel !== '');
          previousHoleCount.current = completedHoles.length;

          setState(prev => ({
            ...prev,
            teams: teamsMap,
            teamMatchup: (group.team_matchup as any) || teamMatchup || null,
            holeResults,
            teamTotals,
            holesPlayed: result.holeResults.length,
            matchState: result.matchState,
          }));
        } catch (e) {
          console.error('Tournament engine error on load:', e);
          setState(prev => ({
            ...prev,
            teams: teamsMap,
            teamMatchup: (group.team_matchup as any) || teamMatchup || null,
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          teams: teamsMap,
          teamMatchup: (group.team_matchup as any) || teamMatchup || null,
        }));
      }

      setIsLoading(false);
    };
    load();
  }, [tournamentGroupId]);

  // Realtime subscription — debounced per-group filtered
  useEffect(() => {
    if (!tournamentGroupId) return;

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => reload(), 3000);
    };

    const channel = supabase
      .channel(`overlay-${tournamentGroupId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_hole_scores',
        filter: `tournament_group_id=eq.${tournamentGroupId}`,
      }, debouncedReload)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_hole_results',
        filter: `tournament_group_id=eq.${tournamentGroupId}`,
      }, debouncedReload)
      .subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [tournamentGroupId, reload]);

  // Sync score locally — marks holes dirty if previously synced
  const syncScore = useCallback(async (
    holeNumber: number,
    roundPlayerId: string,
    grossScore: number,
  ) => {
    if (!tournamentGroupId || !playerMapping || !tournamentGame) return;
    const tournamentPlayerId = playerMapping[roundPlayerId];
    if (!tournamentPlayerId) return;

    // If this hole was already synced to DB, mark it dirty for re-sync
    if (syncedHolesRef.current.has(holeNumber)) {
      dirtyHolesRef.current.add(holeNumber);
    }

    // Update local state
    setAllHoleScores(prev => {
      const updated = { ...prev };
      if (!updated[tournamentPlayerId]) updated[tournamentPlayerId] = {};
      updated[tournamentPlayerId] = { ...updated[tournamentPlayerId], [holeNumber]: grossScore };
      return updated;
    });
  }, [tournamentGroupId, playerMapping, tournamentGame]);

  // Re-run engine whenever local scores change
  useEffect(() => {
    if (!tournamentGame || tournamentPlayers.length === 0 || courseHoles.length === 0) return;
    if (Object.keys(allHoleScores).length === 0) return;

    try {
      const teamNameMap: Record<string, string> = {};
      Object.entries(state.teams).forEach(([id, t]) => { teamNameMap[id] = t.name; });

      const engineInput: EngineInput = {
        game: tournamentGame, holePointOverrides, players: tournamentPlayers,
        teamAssignments, scores: allHoleScores, courseHoles,
        teamNames: teamNameMap, subMatchups,
      };
      const result = calcTournamentHoleResults(engineInput);

      const newHoleResults: Record<number, any> = {};
      const newTeamTotals: Record<string, number> = {};
      result.holeResults.forEach(hr => {
        newHoleResults[hr.holeNumber] = {
          teamPoints: hr.teamPoints, resultLabel: hr.resultLabel,
          grossScores: hr.grossScores, netScores: hr.netScores,
          playerPoints: hr.playerPoints, pointsValue: hr.pointsValue,
        };
        Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
          newTeamTotals[tid] = (newTeamTotals[tid] || 0) + pts;
        });
      });

      const completedHoles = result.holeResults.filter(hr => hr.resultLabel && hr.resultLabel !== '');
      if (completedHoles.length > previousHoleCount.current) {
        const newest = completedHoles[completedHoles.length - 1];
        const winnerTeamId = Object.entries(newest.teamPoints)
          .sort((a, b) => b[1] - a[1])[0];
        setNewlyCompletedHole({
          holeNumber: newest.holeNumber,
          resultLabel: newest.resultLabel,
          teamPoints: newest.teamPoints,
          winnerTeamId: winnerTeamId[1] > 0 ? winnerTeamId[0] : undefined,
          pointsValue: newest.pointsValue,
        });
        previousHoleCount.current = completedHoles.length;
        setTimeout(() => setNewlyCompletedHole(null), 2500);
      }

      setState(prev => ({
        ...prev,
        holeResults: newHoleResults,
        teamTotals: newTeamTotals,
        holesPlayed: result.holeResults.length,
        matchState: result.matchState,
      }));
    } catch (e) {
      console.error('Tournament engine error (local):', e);
    }
  }, [allHoleScores, tournamentGame, tournamentPlayers, courseHoles, holePointOverrides, teamAssignments, subMatchups, state.teams]);

  // Get list of dirty holes (previously synced, then edited)
  const getDirtyHoles = useCallback((): number[] => {
    return Array.from(dirtyHolesRef.current);
  }, []);

  // Per-hole batch sync — syncs one hole's scores + engine results to DB
  const batchSyncHole = useCallback(async (holeNumber: number): Promise<boolean> => {
    if (!tournamentGroupId || !tournamentGame || tournamentPlayers.length === 0 || courseHoles.length === 0) {
      return true;
    }

    try {
      // 1. Check for admin overrides on this hole
      const { data: overridden } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_player_id, hole_number')
        .eq('tournament_group_id', tournamentGroupId)
        .eq('hole_number', holeNumber)
        .eq('is_super_user_override', true);

      const overrideSet = new Set(
        (overridden || []).map(o => `${o.tournament_player_id}_${o.hole_number}`)
      );

      // 2. Build score payload for this hole only
      const scorePayload: {
        tournament_group_id: string;
        tournament_player_id: string;
        hole_number: number;
        gross_score: number;
        is_super_user_override: boolean;
      }[] = [];

      Object.entries(allHoleScores).forEach(([playerId, holes]) => {
        const score = holes[holeNumber];
        if (score === undefined) return;
        if (overrideSet.has(`${playerId}_${holeNumber}`)) return;
        scorePayload.push({
          tournament_group_id: tournamentGroupId,
          tournament_player_id: playerId,
          hole_number: holeNumber,
          gross_score: score,
          is_super_user_override: false,
        });
      });

      // 3. Upsert scores
      if (scorePayload.length > 0) {
        const { error: scoreErr } = await supabase.from('tournament_hole_scores').upsert(
          scorePayload,
          { onConflict: 'tournament_group_id,tournament_player_id,hole_number' },
        );
        if (scoreErr) {
          // Queue each score for offline retry
          scorePayload.forEach(sp => {
            offlineStorage.addTournamentScore(sp.tournament_group_id, sp.tournament_player_id, sp.hole_number, sp.gross_score);
          });
          throw scoreErr;
        }
      }

      // 4. Run engine and upsert results for this hole
      // Cross-group matches own the scoring for the round.
      if (!isTestGroupRef.current && hasRoundMatchesRef.current && tournamentGame.tournamentRoundId) {
        await recalcRoundMatchResults(tournamentGame.tournamentRoundId);
        syncedHolesRef.current.add(holeNumber);
        dirtyHolesRef.current.delete(holeNumber);
        return true;
      }

      // Round-level formats are recomputed for the whole round (all foursomes).
      if (!isTestGroupRef.current && isRoundLevelGameType(tournamentGame.gameType) && tournamentGame.tournamentRoundId) {
        await recalcRoundLevelResults(tournamentGame.tournamentRoundId);
        syncedHolesRef.current.add(holeNumber);
        dirtyHolesRef.current.delete(holeNumber);
        return true;
      }

      const teamNameMap: Record<string, string> = {};
      Object.entries(state.teams).forEach(([id, t]) => { teamNameMap[id] = t.name; });

      const engineInput: EngineInput = {
        game: tournamentGame, holePointOverrides, players: tournamentPlayers,
        teamAssignments, scores: allHoleScores, courseHoles,
        teamNames: teamNameMap, subMatchups,
      };
      const result = calcTournamentHoleResults(engineInput);

      const holeResult = result.holeResults.find(hr => hr.holeNumber === holeNumber);
      if (holeResult && holeResult.resultLabel && holeResult.resultLabel !== '') {
        const resultPayload = [{
          tournament_group_id: tournamentGroupId,
          hole_number: holeResult.holeNumber,
          team_points: holeResult.teamPoints,
          player_points: holeResult.playerPoints,
          points_value: holeResult.pointsValue,
          result_label: holeResult.resultLabel,
          updated_at: new Date().toISOString(),
        }];

        const { error: resultErr } = await supabase.from('tournament_hole_results').upsert(
          resultPayload,
          { onConflict: 'tournament_group_id,hole_number' },
        );
        if (resultErr) {
          offlineStorage.addTournamentResult(tournamentGroupId, resultPayload);
          throw resultErr;
        }
      }


      // Mark hole as synced and remove from dirty set
      syncedHolesRef.current.add(holeNumber);
      dirtyHolesRef.current.delete(holeNumber);

      return true;
    } catch (e) {
      console.error(`batchSyncHole(${holeNumber}) failed:`, e);
      return false;
    }
  }, [tournamentGroupId, tournamentGame, tournamentPlayers, courseHoles, holePointOverrides, teamAssignments, allHoleScores, subMatchups, state.teams]);

  // Batch sync all scores and results to DB — called only on round completion
  // Accepts optional externalScores to avoid race conditions with React state
  const batchSyncAllScores = useCallback(async (
    externalScores?: Record<string, Record<number, number>>,
  ): Promise<boolean> => {
    if (!tournamentGroupId || !tournamentGame || tournamentPlayers.length === 0 || courseHoles.length === 0) {
      return true;
    }

    const scoresToSync = externalScores || allHoleScores;

    try {
      // 1. Check for admin overrides — exclude those player/hole combos
      const { data: overridden } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_player_id, hole_number')
        .eq('tournament_group_id', tournamentGroupId)
        .eq('is_super_user_override', true);

      const overrideSet = new Set(
        (overridden || []).map(o => `${o.tournament_player_id}_${o.hole_number}`)
      );

      // Also fetch the actual admin override scores to include in engine input
      const { data: overriddenScores } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_player_id, hole_number, gross_score')
        .eq('tournament_group_id', tournamentGroupId)
        .eq('is_super_user_override', true);

      // Create a merged scores map that includes admin overrides
      const mergedScores = { ...scoresToSync };
      (overriddenScores || []).forEach(o => {
        if (!mergedScores[o.tournament_player_id]) mergedScores[o.tournament_player_id] = {};
        mergedScores[o.tournament_player_id][o.hole_number] = o.gross_score;
      });

      // 2. Build score payload, skipping admin-overridden scores
      const scorePayload: {
        tournament_group_id: string;
        tournament_player_id: string;
        hole_number: number;
        gross_score: number;
        is_super_user_override: boolean;
      }[] = [];

      Object.entries(scoresToSync).forEach(([playerId, holes]) => {
        Object.entries(holes).forEach(([holeStr, score]) => {
          const holeNum = Number(holeStr);
          if (overrideSet.has(`${playerId}_${holeNum}`)) return; // skip admin override
          scorePayload.push({
            tournament_group_id: tournamentGroupId,
            tournament_player_id: playerId,
            hole_number: holeNum,
            gross_score: score,
            is_super_user_override: false,
          });
        });
      });

      if (scorePayload.length > 0) {
        const { data: scoreData, error: scoreErr } = await supabase.from('tournament_hole_scores').upsert(
          scorePayload,
          { onConflict: 'tournament_group_id,tournament_player_id,hole_number' },
        ).select('id');
        if (scoreErr) throw scoreErr;

        // 3. Verify row count
        const expectedCount = scorePayload.length;
        const actualCount = scoreData?.length ?? 0;
        if (actualCount < expectedCount) {
          console.warn(`Score sync mismatch: expected ${expectedCount}, got ${actualCount}. Some rows may have been blocked by RLS.`);
        }
      }

      // 4. Re-run engine and upsert results (using mergedScores which includes admin overrides)
      if (!isTestGroupRef.current && hasRoundMatchesRef.current && tournamentGame.tournamentRoundId) {
        await recalcRoundMatchResults(tournamentGame.tournamentRoundId);
        return true;
      }

      if (!isTestGroupRef.current && isRoundLevelGameType(tournamentGame.gameType) && tournamentGame.tournamentRoundId) {
        await recalcRoundLevelResults(tournamentGame.tournamentRoundId);
        return true;
      }

      const teamNameMap: Record<string, string> = {};

      Object.entries(state.teams).forEach(([id, t]) => { teamNameMap[id] = t.name; });

      const engineInput: EngineInput = {
        game: tournamentGame, holePointOverrides, players: tournamentPlayers,
        teamAssignments, scores: mergedScores, courseHoles,
        teamNames: teamNameMap, subMatchups,
      };
      const result = calcTournamentHoleResults(engineInput);

      const resultPayload = result.holeResults
        .filter(hr => hr.resultLabel && hr.resultLabel !== '')
        .map(hr => ({
          tournament_group_id: tournamentGroupId,
          hole_number: hr.holeNumber,
          team_points: hr.teamPoints,
          player_points: hr.playerPoints,
          points_value: hr.pointsValue,
          result_label: hr.resultLabel,
          updated_at: new Date().toISOString(),
        }));

      if (resultPayload.length > 0) {
        const { data: resultData, error: resultErr } = await supabase.from('tournament_hole_results').upsert(
          resultPayload,
          { onConflict: 'tournament_group_id,hole_number' },
        ).select('id');
        if (resultErr) throw resultErr;

        const expectedResults = resultPayload.length;
        const actualResults = resultData?.length ?? 0;
        if (actualResults < expectedResults) {
          console.warn(`Result sync mismatch: expected ${expectedResults}, got ${actualResults}.`);
        }
      }

      return true;
    } catch (e) {
      console.error('Batch tournament sync failed:', e);
      return false;
    }
  }, [tournamentGroupId, tournamentGame, tournamentPlayers, courseHoles, holePointOverrides, teamAssignments, allHoleScores, subMatchups, state.teams]);

  // Compute segment totals for sum-of-strokes sixes
  const segmentTotals: SegmentTotal[] | null = (() => {
    if (!tournamentGame || tournamentGame.gameType !== 'tournament_sixes' || tournamentGame.sixesFormat !== 'sum_of_strokes') return null;
    if (!state.teamMatchup) return null;

    const segPts = tournamentGame.sixesSegmentPoints || [1, 1, 1];
    const segments = [
      { start: 1, end: 6 },
      { start: 7, end: 12 },
      { start: 13, end: 18 },
    ];

    return segments.map((seg, idx) => {
      const teamSums: Record<string, number> = {};
      let holesComplete = 0;
      const totalHoles = seg.end - seg.start + 1;

      for (let h = seg.start; h <= seg.end; h++) {
        const allScored = tournamentPlayers.every(p => allHoleScores[p.id]?.[h] !== undefined);
        if (!allScored) continue;
        holesComplete++;

        tournamentPlayers.forEach(p => {
          const tid = teamAssignments[p.id];
          if (!tid) return;
          const gross = allHoleScores[p.id]?.[h] ?? 0;
          teamSums[tid] = (teamSums[tid] || 0) + gross;
        });
      }

      const isComplete = holesComplete === totalHoles;
      const teamIds = Object.keys(teamSums);
      let winnerTeamId: string | undefined;
      let label = 'Not started yet';

      if (holesComplete > 0 && teamIds.length === 2) {
        const diff = (teamSums[teamIds[0]] || 0) - (teamSums[teamIds[1]] || 0);
        if (isComplete) {
          if (diff < 0) { winnerTeamId = teamIds[0]; label = `${state.teams[teamIds[0]]?.name || 'Team A'} wins`; }
          else if (diff > 0) { winnerTeamId = teamIds[1]; label = `${state.teams[teamIds[1]]?.name || 'Team B'} wins`; }
          else label = 'Halved';
        } else {
          if (diff < 0) label = `${state.teams[teamIds[0]]?.name || 'Team A'} leads by ${Math.abs(diff)} strokes`;
          else if (diff > 0) label = `${state.teams[teamIds[1]]?.name || 'Team B'} leads by ${Math.abs(diff)} strokes`;
          else label = 'All Square';
        }
      }

      return {
        teamSums, holesComplete, totalHoles, pointsAvailable: segPts[idx],
        isComplete, winnerTeamId, label,
      };
    });
  })();

  return {
    ...state,
    isLoading,
    syncScore,
    batchSyncHole,
    batchSyncAllScores,
    getDirtyHoles,
    tournamentGame,
    tournamentPlayers,
    teamAssignments,
    courseHoles,
    allHoleScores,
    newlyCompletedHole,
    segmentTotals,
    subMatchups,
  };
};
