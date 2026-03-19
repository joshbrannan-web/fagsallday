import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useTournamentDetail = (tournamentId: string | undefined) => {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [scoreboards, setScoreboards] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tournamentId || !user) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [tRes, teamsRes, playersRes, roundsRes, sbRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('display_order'),
        supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId).order('display_name'),
        supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
        supabase.from('tournament_scoreboards').select('*').eq('tournament_id', tournamentId).order('display_order'),
      ]);
      setTournament(tRes.data);
      setTeams(teamsRes.data || []);
      setPlayers(playersRes.data || []);
      setRounds(roundsRes.data || []);
      setScoreboards(sbRes.data || []);

      // Fetch games for each round
      const roundIds = (roundsRes.data || []).map((r: any) => r.id);
      if (roundIds.length > 0) {
        const { data: gamesData } = await supabase
          .from('tournament_games')
          .select('*')
          .in('tournament_round_id', roundIds);
        setGames(gamesData || []);
      }

      // Fetch groups for all rounds
      if (roundIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('tournament_groups')
          .select('*')
          .in('tournament_round_id', roundIds)
          .order('group_number');
        setGroups(groupsData || []);

        // Fetch group players
        const groupIds = (groupsData || []).map((g: any) => g.id);
        if (groupIds.length > 0) {
          const { data: gpData } = await supabase
            .from('tournament_group_players')
            .select('*')
            .in('tournament_group_id', groupIds);
          setGroupPlayers(gpData || []);
        } else {
          setGroupPlayers([]);
        }
      } else {
        setGroupPlayers([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tournament details');
    }
    setIsLoading(false);
  }, [tournamentId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateTeam = async (teamId: string, updates: { name?: string; color?: string }) => {
    const { error } = await supabase.from('tournament_teams').update(updates).eq('id', teamId);
    if (error) toast.error('Failed to update team');
    else await fetchAll();
  };

  const updatePlayer = async (playerId: string, updates: { handicap_override?: number | null; team_id?: string; display_name?: string }) => {
    const { error } = await supabase.from('tournament_players').update(updates).eq('id', playerId);
    if (error) toast.error('Failed to update player');
    else await fetchAll();
  };

  const addPlayer = async (data: { display_name: string; handicap_index: number; team_id: string; user_id?: string }) => {
    const { error } = await supabase.from('tournament_players').insert({ ...data, tournament_id: tournamentId });
    if (error) { toast.error('Failed to add player'); return; }
    // Auto-add as tournament member if linked to a user
    if (data.user_id && tournamentId) {
      await supabase.from('tournament_members').upsert(
        { tournament_id: tournamentId, user_id: data.user_id },
        { onConflict: 'tournament_id,user_id' }
      );
    }
    await fetchAll();
  };

  const removePlayer = async (playerId: string) => {
    const { error } = await supabase.from('tournament_players').delete().eq('id', playerId);
    if (error) toast.error('Failed to remove player');
    else await fetchAll();
  };

  const startRound = async (roundId: string) => {
    const { error } = await supabase.from('tournament_rounds').update({ status: 'active' }).eq('id', roundId);
    if (error) toast.error('Failed to start round');
    else { toast.success('Round started'); await fetchAll(); }
  };

  const completeRound = async (roundId: string) => {
    const { error } = await supabase.from('tournament_rounds').update({ status: 'completed' }).eq('id', roundId);
    if (error) toast.error('Failed to complete round');
    else { toast.success('Round completed'); await fetchAll(); }
  };

  const updateRound = async (roundId: string, updates: any) => {
    const { error } = await supabase.from('tournament_rounds').update(updates).eq('id', roundId);
    if (error) toast.error('Failed to update round');
    else await fetchAll();
  };

  const updateGame = async (gameId: string, updates: any) => {
    const { error } = await supabase.from('tournament_games').update(updates).eq('id', gameId);
    if (error) toast.error('Failed to update game');
    else await fetchAll();
  };

  const addScoreboard = async (data: { name: string; scoreboard_type: string; sort_metric: string; sort_direction?: string; show_round_breakdown?: boolean }) => {
    const maxOrder = scoreboards.length > 0 ? Math.max(...scoreboards.map((s: any) => s.display_order || 0)) + 1 : 0;
    const { error } = await supabase.from('tournament_scoreboards').insert({ ...data, tournament_id: tournamentId, display_order: maxOrder });
    if (error) toast.error('Failed to add scoreboard');
    else await fetchAll();
  };

  const updateScoreboard = async (id: string, updates: any) => {
    const { error } = await supabase.from('tournament_scoreboards').update(updates).eq('id', id);
    if (error) toast.error('Failed to update scoreboard');
    else await fetchAll();
  };

  const deleteScoreboard = async (id: string) => {
    const { error } = await supabase.from('tournament_scoreboards').delete().eq('id', id);
    if (error) toast.error('Failed to delete scoreboard');
    else await fetchAll();
  };

  const addTeam = async (data: { name: string; color: string }) => {
    const maxOrder = teams.length > 0 ? Math.max(...teams.map((t: any) => t.display_order || 0)) + 1 : 0;
    const { error } = await supabase.from('tournament_teams').insert({ ...data, tournament_id: tournamentId, display_order: maxOrder });
    if (error) toast.error('Failed to add team');
    else await fetchAll();
  };

  const deleteTeam = async (teamId: string) => {
    const teamPlayers = players.filter((p: any) => p.team_id === teamId);
    if (teamPlayers.length > 0) { toast.error('Remove all players from team first'); return; }
    const { error } = await supabase.from('tournament_teams').delete().eq('id', teamId);
    if (error) toast.error('Failed to delete team');
    else await fetchAll();
  };

  const addGroup = async (roundId: string, playerIds: string[], subMatchups?: { playerA: string; playerB: string }[]) => {
    // Use DB count to avoid stale closure issues with rapid sequential calls
    const { count } = await supabase
      .from('tournament_groups')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_round_id', roundId);
    const nextGroupNumber = (count || 0) + 1;
    const selectedPlayerObjs = players.filter((p: any) => playerIds.includes(p.id));
    const teamIds = [...new Set(selectedPlayerObjs.map((p: any) => p.team_id).filter(Boolean))];
    const teamMatchup = teamIds.length === 2
      ? { teamAId: teamIds[0], teamBId: teamIds[1], ...(subMatchups ? { subMatchups } : {}) }
      : subMatchups ? { subMatchups } : null;

    const { data: newGroup, error: groupErr } = await supabase
      .from('tournament_groups')
      .insert({
        tournament_round_id: roundId,
        group_number: nextGroupNumber,
        team_matchup: teamMatchup as any,
        status: 'pending',
      })
      .select('id')
      .single();
    if (groupErr || !newGroup) { console.error('Failed to create group:', groupErr); toast.error('Failed to create group'); return; }

    const gpInserts = selectedPlayerObjs.map((p: any) => ({
      tournament_group_id: newGroup.id,
      tournament_player_id: p.id,
      team_id: p.team_id || teams[0]?.id || '',
    }));
    const { error: gpErr } = await supabase.from('tournament_group_players').insert(gpInserts);
    if (gpErr) { console.error('Failed to add group players:', gpErr); toast.error('Group created but failed to add players'); }
    else toast.success('Group added');
    await fetchAll();
  };

  const deleteGroup = async (groupId: string) => {
    await supabase.from('tournament_group_players').delete().eq('tournament_group_id', groupId);
    const { error } = await supabase.from('tournament_groups').delete().eq('id', groupId);
    if (error) toast.error('Failed to delete group');
    else { toast.success('Group deleted'); await fetchAll(); }
  };

  const updateTournament = async (updates: { name?: string; description?: string | null; start_date?: string | null; end_date?: string | null; status?: string }) => {
    if (!tournamentId) return;
    const { error } = await supabase.from('tournaments').update(updates).eq('id', tournamentId);
    if (error) toast.error('Failed to update tournament');
    else { toast.success('Tournament updated'); await fetchAll(); }
  };

  const deleteTournament = async (): Promise<{ success: boolean }> => {
    if (!tournamentId) return { success: false };

    // Step 1: Delete all rounds belonging to this tournament via edge function
    const { data: deleteResult, error: deleteRoundsError } = await supabase.functions.invoke(
      'delete-tournament-rounds',
      { body: { tournamentId } }
    );

    if (deleteRoundsError) {
      console.error('Failed to delete tournament rounds:', deleteRoundsError);
      toast.error('Failed to clean up tournament rounds. Tournament not deleted.');
      return { success: false };
    }

    console.log(`Cleaned up ${deleteResult?.deleted ?? 0} tournament rounds`);

    // Step 2: Clear this admin's own offline cache if it belongs to this tournament
    try {
      const cachedRoundRaw = localStorage.getItem('fg_offline_round');
      if (cachedRoundRaw) {
        const cachedRound = JSON.parse(cachedRoundRaw);
        const cachedTournamentId = cachedRound?.gameData?._TOURNAMENT_META?.tournamentId;
        if (cachedTournamentId === tournamentId) {
          localStorage.removeItem('fg_offline_round');
          localStorage.removeItem('fg_sync_queue');
        }
      }
    } catch {
      // non-critical, ignore
    }

    // Step 3: Delete the tournament record (cascade handles tournament tables)
    const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
    if (error) { toast.error('Failed to delete tournament'); return { success: false }; }
    toast.success('Tournament deleted');
    return { success: true };
  };

  const addRound = async (roundNumber: number) => {
    if (!tournamentId) return;
    const { data: roundData, error: roundErr } = await supabase.from('tournament_rounds').insert({
      tournament_id: tournamentId,
      round_number: roundNumber,
      course_data: {},
      status: 'pending',
    }).select().single();
    if (roundErr || !roundData) { toast.error('Failed to add round'); return; }
    // Insert default game for this round
    const { error: gameErr } = await supabase.from('tournament_games').insert({
      tournament_round_id: roundData.id,
      game_type: 'match_play_best_ball',
    });
    if (gameErr) toast.error('Round added but failed to create default game config');
    else toast.success('Round added');
    await fetchAll();
  };

  const deleteRound = async (roundId: string) => {
    const { error } = await supabase.from('tournament_rounds').delete().eq('id', roundId);
    if (error) { toast.error('Failed to delete round'); return; }
    toast.success('Round deleted');
    await fetchAll();
  };

  return {
    tournament, teams, players, rounds, games, scoreboards, groups, groupPlayers, isLoading,
    refetch: fetchAll,
    updateTournament, deleteTournament, updateTeam, updatePlayer, addPlayer, removePlayer,
    startRound, completeRound, updateRound, updateGame, addRound, deleteRound,
    addScoreboard, updateScoreboard, deleteScoreboard,
    addTeam, deleteTeam, addGroup, deleteGroup,
  };
};
