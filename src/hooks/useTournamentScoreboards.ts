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
        setHolePoints(hpRes.data || []);

        // Fetch scores and results
        await fetchScoresAndResults(groupIds);
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
    setHoleScores(scoresRes.data || []);
    setHoleResults(resultsRes.data || []);
    setLastUpdated(new Date());
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
