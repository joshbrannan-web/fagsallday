import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcTournamentHoleResults, type EngineInput, type RoundResult, type CourseHole } from '@/services/tournamentEngine';
import type { TournamentPlayer, TournamentGame, TournamentHolePoints, MatchState } from '@/types/tournament';

interface OverlayState {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
  matchState?: MatchState;
}

export const useTournamentOverlay = (
  tournamentGroupId: string | undefined,
  tournamentName?: string,
  roundName?: string,
  playerMapping?: Record<string, string>, // roundPlayerId → tournamentPlayerId
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

  // Engine supplementary data loaded on mount
  const [tournamentGame, setTournamentGame] = useState<TournamentGame | null>(null);
  const [holePointOverrides, setHolePointOverrides] = useState<TournamentHolePoints[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({});
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [allHoleScores, setAllHoleScores] = useState<Record<string, Record<number, number>>>({});

  useEffect(() => {
    if (!tournamentGroupId) { setIsLoading(false); return; }
    const load = async () => {
      setIsLoading(true);

      // Get group → round → tournament
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

      // Parallel fetches
      const [teamsRes, resultsRes, gameRes, groupPlayersRes, playersRes, scoresRes] = await Promise.all([
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_hole_results').select('*').eq('tournament_group_id', tournamentGroupId),
        supabase.from('tournament_games').select('*').eq('tournament_round_id', group.tournament_round_id).single(),
        supabase.from('tournament_group_players').select('tournament_player_id, team_id').eq('tournament_group_id', tournamentGroupId),
        supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_hole_scores').select('*').eq('tournament_group_id', tournamentGroupId),
      ]);

      // Teams
      const teamsMap: Record<string, { name: string; color: string }> = {};
      (teamsRes.data || []).forEach(t => { teamsMap[t.id] = { name: t.name, color: t.color }; });

      // Hole results
      const holeResults: Record<number, any> = {};
      const teamTotals: Record<string, number> = {};
      (resultsRes.data || []).forEach(r => {
        holeResults[r.hole_number] = {
          teamPoints: r.team_points as Record<string, number>,
          resultLabel: r.result_label,
        };
        const tp = r.team_points as Record<string, number>;
        Object.entries(tp).forEach(([tid, pts]) => {
          teamTotals[tid] = (teamTotals[tid] || 0) + (pts as number);
        });
      });

      // Game config
      if (gameRes.data) {
        const g = gameRes.data;
        setTournamentGame({
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
        });

        // Fetch hole point overrides for this game
        const { data: hpData } = await supabase
          .from('tournament_hole_points')
          .select('*')
          .eq('tournament_game_id', g.id);
        setHolePointOverrides((hpData || []).map(hp => ({
          id: hp.id,
          tournamentGameId: hp.tournament_game_id,
          holeNumber: hp.hole_number,
          points: hp.points,
        })));
      }

      // Group player → team assignments
      const assignments: Record<string, string> = {};
      (groupPlayersRes.data || []).forEach(gp => {
        assignments[gp.tournament_player_id] = gp.team_id;
      });
      setTeamAssignments(assignments);

      // Players in group
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

      // Course holes
      const cd = round.course_data as any;
      const holes: CourseHole[] = (cd?.holes || []).map((h: any, i: number) => ({
        number: i + 1,
        par: h.par || 4,
        handicapIndex: h.handicapIndex || (i + 1),
      }));
      setCourseHoles(holes);

      // Scores
      const scoresMap: Record<string, Record<number, number>> = {};
      (scoresRes.data || []).forEach(s => {
        if (s.gross_score !== null) {
          if (!scoresMap[s.tournament_player_id]) scoresMap[s.tournament_player_id] = {};
          scoresMap[s.tournament_player_id][s.hole_number] = s.gross_score;
        }
      });
      setAllHoleScores(scoresMap);

      setState(prev => ({
        ...prev,
        teams: teamsMap,
        teamMatchup: (group.team_matchup as any) || teamMatchup || null,
        holeResults,
        teamTotals,
        holesPlayed: Object.keys(holeResults).length,
      }));
      setIsLoading(false);
    };
    load();
  }, [tournamentGroupId]);

  // Sync score to tournament_hole_scores and run engine
  const syncScore = useCallback(async (
    holeNumber: number,
    roundPlayerId: string,
    grossScore: number,
  ) => {
    if (!tournamentGroupId || !playerMapping || !tournamentGame) return;
    const tournamentPlayerId = playerMapping[roundPlayerId];
    if (!tournamentPlayerId) return;

    // 1. Write to tournament_hole_scores
    await supabase.from('tournament_hole_scores').upsert({
      tournament_group_id: tournamentGroupId,
      tournament_player_id: tournamentPlayerId,
      hole_number: holeNumber,
      gross_score: grossScore,
      is_super_user_override: false,
    }, {
      onConflict: 'tournament_group_id,tournament_player_id,hole_number',
    });

    // 2. Build updated scores map
    const updatedScores = { ...allHoleScores };
    if (!updatedScores[tournamentPlayerId]) updatedScores[tournamentPlayerId] = {};
    updatedScores[tournamentPlayerId] = { ...updatedScores[tournamentPlayerId], [holeNumber]: grossScore };

    // 3. Run engine
    const engineInput: EngineInput = {
      game: tournamentGame,
      holePointOverrides,
      players: tournamentPlayers,
      teamAssignments,
      scores: updatedScores,
      courseHoles,
    };

    try {
      const result = calcTournamentHoleResults(engineInput);

      // 4. Update local state
      const newHoleResults: Record<number, any> = {};
      const newTeamTotals: Record<string, number> = {};
      result.holeResults.forEach(hr => {
        newHoleResults[hr.holeNumber] = {
          teamPoints: hr.teamPoints,
          resultLabel: hr.resultLabel,
        };
        Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
          newTeamTotals[tid] = (newTeamTotals[tid] || 0) + pts;
        });
      });

      setState(prev => ({
        ...prev,
        holeResults: newHoleResults,
        teamTotals: newTeamTotals,
        holesPlayed: result.holeResults.length,
        matchState: result.matchState,
      }));

      // 5. Upsert tournament_hole_results
      const upsertPayload = result.holeResults.map(hr => ({
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

      // 6. Update local scores state
      setAllHoleScores(updatedScores);
    } catch (e) {
      console.error('Tournament engine error:', e);
    }
  }, [tournamentGroupId, playerMapping, tournamentGame, holePointOverrides, tournamentPlayers, teamAssignments, courseHoles, allHoleScores]);

  return { ...state, isLoading, syncScore };
};
