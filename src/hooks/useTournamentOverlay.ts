import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type RoundResult, type CourseHole } from '@/services/tournamentEngine';
import type { TournamentPlayer, TournamentGame, TournamentHolePoints, MatchState } from '@/types/tournament';

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

  // Animation trigger
  const previousHoleCount = useRef(0);
  const [newlyCompletedHole, setNewlyCompletedHole] = useState<NewHoleEvent | null>(null);

  // Stable refs for reload to avoid stale closures
  const tournamentGameRef = useRef<TournamentGame | null>(null);
  const holePointOverridesRef = useRef<TournamentHolePoints[]>([]);
  const tournamentPlayersRef = useRef<TournamentPlayer[]>([]);
  const teamAssignmentsRef = useRef<Record<string, string>>({});
  const courseHolesRef = useRef<CourseHole[]>([]);

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

      // Persist computed results to tournament_hole_results so scoreboards stay in sync
      const upsertPayload = result.holeResults
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

      if (upsertPayload.length > 0) {
        await supabase.from('tournament_hole_results').upsert(
          upsertPayload,
          { onConflict: 'tournament_group_id,hole_number' },
        );
      }
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
        .select('tournament_round_id, team_matchup')
        .eq('id', tournamentGroupId)
        .single();

      if (!group) { setIsLoading(false); return; }

      const { data: round } = await supabase
        .from('tournament_rounds')
        .select('tournament_id, course_data')
        .eq('id', group.tournament_round_id)
        .single();

      if (!round) { setIsLoading(false); return; }

      const [teamsRes, gameRes, groupPlayersRes, playersRes, scoresRes] = await Promise.all([
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_games').select('*').eq('tournament_round_id', group.tournament_round_id).single(),
        supabase.from('tournament_group_players').select('tournament_player_id, team_id').eq('tournament_group_id', tournamentGroupId),
        supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_hole_scores').select('*').eq('tournament_group_id', tournamentGroupId),
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

        const { data: hpData } = await supabase
          .from('tournament_hole_points')
          .select('*')
          .eq('tournament_game_id', g.id);
        overrides = (hpData || []).map(hp => ({
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
        teamNames: teamNameMap,
      };
          const result = calcTournamentHoleResults(engineInput);

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

  // Realtime subscription (#67, #68)
  useEffect(() => {
    if (!tournamentGroupId) return;
    const channel = supabase
      .channel(`overlay-${tournamentGroupId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_hole_scores',
        filter: `tournament_group_id=eq.${tournamentGroupId}`,
      }, () => reload())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tournament_hole_results',
        filter: `tournament_group_id=eq.${tournamentGroupId}`,
      }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournamentGroupId, reload]);

  // Sync score to tournament_hole_scores and run engine
  const syncScore = useCallback(async (
    holeNumber: number,
    roundPlayerId: string,
    grossScore: number,
  ) => {
    if (!tournamentGroupId || !playerMapping || !tournamentGame) return;
    const tournamentPlayerId = playerMapping[roundPlayerId];
    if (!tournamentPlayerId) return;

    await supabase.from('tournament_hole_scores').upsert({
      tournament_group_id: tournamentGroupId,
      tournament_player_id: tournamentPlayerId,
      hole_number: holeNumber,
      gross_score: grossScore,
      is_super_user_override: false,
    }, {
      onConflict: 'tournament_group_id,tournament_player_id,hole_number',
    });

    // Realtime subscription will trigger reload for all clients including this one
  }, [tournamentGroupId, playerMapping, tournamentGame]);

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
    tournamentGame,
    tournamentPlayers,
    teamAssignments,
    courseHoles,
    allHoleScores,
    newlyCompletedHole,
    segmentTotals,
  };
};
