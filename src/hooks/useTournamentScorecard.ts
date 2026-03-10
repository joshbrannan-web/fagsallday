import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcTournamentHoleResults, type EngineInput, type CourseHole } from '@/services/tournamentEngine';
import type { TournamentPlayer, TournamentGame, TournamentHolePoints } from '@/types/tournament';

export const useTournamentScorecard = (groupId: string | undefined) => {
  const [scores, setScores] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Engine supplementary data
  const [tournamentGame, setTournamentGame] = useState<TournamentGame | null>(null);
  const [holePointOverrides, setHolePointOverrides] = useState<TournamentHolePoints[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [subMatchups, setSubMatchups] = useState<{ playerA: string; playerB: string }[] | undefined>(undefined);

  const fetchData = useCallback(async () => {
    if (!groupId) { setIsLoading(false); return; }
    setIsLoading(true);
    const [scoresRes, resultsRes] = await Promise.all([
      supabase.from('tournament_hole_scores').select('*').eq('tournament_group_id', groupId),
      supabase.from('tournament_hole_results').select('*').eq('tournament_group_id', groupId),
    ]);
    setScores(scoresRes.data || []);
    setResults(resultsRes.data || []);
    setIsLoading(false);
  }, [groupId]);

  // Load engine supplementary data on mount
  useEffect(() => {
    if (!groupId) return;
    const loadEngineData = async () => {
      const { data: group } = await supabase
        .from('tournament_groups')
        .select('tournament_round_id, team_matchup')
        .eq('id', groupId)
        .single();
      if (!group) return;

      // Extract subMatchups from team_matchup JSONB
      const tm = group.team_matchup as any;
      const extractedSubMatchups: { playerA: string; playerB: string }[] | undefined =
        tm?.subMatchups && Array.isArray(tm.subMatchups) ? tm.subMatchups : undefined;
      setSubMatchups(extractedSubMatchups);

      const { data: round } = await supabase
        .from('tournament_rounds')
        .select('tournament_id, course_data')
        .eq('id', group.tournament_round_id)
        .single();
      if (!round) return;

      const [gameRes, gpRes, playersRes, teamsRes] = await Promise.all([
        supabase.from('tournament_games').select('*').eq('tournament_round_id', group.tournament_round_id).single(),
        supabase.from('tournament_group_players').select('tournament_player_id, team_id').eq('tournament_group_id', groupId),
        supabase.from('tournament_players').select('*').eq('tournament_id', round.tournament_id),
        supabase.from('tournament_teams').select('id, name').eq('tournament_id', round.tournament_id),
      ]);

      const names: Record<string, string> = {};
      (teamsRes.data || []).forEach(t => { names[t.id] = t.name; });
      setTeamNames(names);

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

      const assignments: Record<string, string> = {};
      (gpRes.data || []).forEach(gp => {
        assignments[gp.tournament_player_id] = gp.team_id;
      });
      setTeamAssignments(assignments);

      const groupPlayerIds = new Set((gpRes.data || []).map(gp => gp.tournament_player_id));
      setTournamentPlayers(
        (playersRes.data || [])
          .filter(p => groupPlayerIds.has(p.id))
          .map(p => ({
            id: p.id,
            tournamentId: p.tournament_id,
            userId: p.user_id ?? undefined,
            displayName: p.display_name,
            handicapIndex: p.handicap_index,
            handicapOverride: p.handicap_override ?? undefined,
            teamId: p.team_id ?? undefined,
          })),
      );

      const cd = round.course_data as any;
      setCourseHoles(
        (cd?.holes || []).map((h: any, i: number) => ({
          number: i + 1,
          par: h.par || 4,
          handicapIndex: h.handicapIndex || (i + 1),
        })),
      );
    };
    loadEngineData();
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`scorecard-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_hole_scores',
        filter: `tournament_group_id=eq.${groupId}`,
      }, () => fetchData())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_hole_results',
        filter: `tournament_group_id=eq.${groupId}`,
      }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, fetchData]);

  const overrideScore = async (playerId: string, holeNumber: number, grossScore: number) => {
    // Upsert score
    const existing = scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === holeNumber);
    if (existing) {
      const { error } = await supabase
        .from('tournament_hole_scores')
        .update({ gross_score: grossScore, is_super_user_override: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { toast.error('Failed to update score'); return; }
    } else {
      const { error } = await supabase
        .from('tournament_hole_scores')
        .insert({
          tournament_group_id: groupId,
          tournament_player_id: playerId,
          hole_number: holeNumber,
          gross_score: grossScore,
          is_super_user_override: true,
        });
      if (error) { toast.error('Failed to save score'); return; }
    }

    toast.success('Score updated');

    // Run engine recalculation
    if (!tournamentGame || !groupId) return;

    // Build scores map from current state + override
    const scoresMap: Record<string, Record<number, number>> = {};
    scores.forEach((s: any) => {
      if (s.gross_score !== null) {
        if (!scoresMap[s.tournament_player_id]) scoresMap[s.tournament_player_id] = {};
        scoresMap[s.tournament_player_id][s.hole_number] = s.gross_score;
      }
    });
    // Apply override
    if (!scoresMap[playerId]) scoresMap[playerId] = {};
    scoresMap[playerId][holeNumber] = grossScore;

    try {
      const engineInput: EngineInput = {
        game: tournamentGame,
        holePointOverrides,
        players: tournamentPlayers,
        teamAssignments,
        scores: scoresMap,
        courseHoles,
        teamNames,
      };

      const result = calcTournamentHoleResults(engineInput);

      const upsertPayload = result.holeResults.map(hr => ({
        tournament_group_id: groupId,
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
      console.error('Tournament engine error on override:', e);
    }
  };

  return { scores, results, isLoading, overrideScore, refetch: fetchData };
};
