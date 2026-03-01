import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Tournament {
  id: string;
  creator_id: string;
  name: string;
  join_code: string;
  scoring_mode: 'stroke_play' | 'points';
  max_players: number;
  status: 'SETUP' | 'ACTIVE' | 'COMPLETE';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  user_id: string | null;
  player_name: string;
  handicap_index: number;
  role: 'super_user' | 'scorekeeper' | 'player';
  created_at: string;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  course_data: Record<string, any>;
  teams_data: any[];
  games_data: any[];
  scores: Record<string, any>;
  points_data: Record<string, any>;
  scorekeeper_id: string | null;
  status: 'SETUP' | 'ACTIVE' | 'COMPLETE';
  start_time: string | null;
  created_at: string;
  updated_at: string;
}

export const useTournament = (tournamentId?: string) => {
  const { user, profile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myRole, setMyRole] = useState<'super_user' | 'scorekeeper' | 'player' | null>(null);

  // Fetch user's tournaments
  const fetchTournaments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTournaments(data as unknown as Tournament[]);
    setIsLoading(false);
  }, [user]);

  // Fetch single tournament details
  const fetchTournament = useCallback(async () => {
    if (!tournamentId || !user) return;
    setIsLoading(true);

    const [tRes, pRes, rRes] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId).order('created_at'),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
    ]);

    if (tRes.data) setTournament(tRes.data as unknown as Tournament);
    if (pRes.data) {
      const playerData = pRes.data as unknown as TournamentPlayer[];
      setPlayers(playerData);
      const me = playerData.find(p => p.user_id === user.id);
      setMyRole(me?.role ?? null);
    }
    if (rRes.data) setRounds(rRes.data as unknown as TournamentRound[]);
    setIsLoading(false);
  }, [tournamentId, user]);

  useEffect(() => {
    if (tournamentId) {
      fetchTournament();
    } else {
      fetchTournaments();
    }
  }, [tournamentId, fetchTournament, fetchTournaments]);

  // Realtime subscription for rounds
  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_rounds',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => {
        fetchTournament();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, fetchTournament]);

  const createTournament = async (name: string, scoringMode: 'stroke_play' | 'points', maxPlayers: number) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        creator_id: user.id,
        name,
        scoring_mode: scoringMode,
        max_players: maxPlayers,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to create tournament'); return null; }

    const t = data as unknown as Tournament;

    // Add creator as super_user player
    await supabase.from('tournament_players').insert({
      tournament_id: t.id,
      user_id: user.id,
      player_name: profile?.display_name || 'Tournament Creator',
      handicap_index: profile?.handicap_index || 0,
      role: 'super_user',
    });

    toast.success('Tournament created!');
    return t;
  };

  const joinTournament = async (joinCode: string) => {
    if (!user) return null;
    // Find tournament by code
    const { data: t, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .single();

    if (error || !t) { toast.error('Tournament not found'); return null; }
    const tournament = t as unknown as Tournament;

    // Check if already joined
    const { data: existing } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return tournament;
    }

    // Check max players
    const { count } = await supabase
      .from('tournament_players')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id);

    if (count && count >= tournament.max_players) {
      toast.error('Tournament is full');
      return null;
    }

    const { error: joinError } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        player_name: profile?.display_name || 'Player',
        handicap_index: profile?.handicap_index || 0,
        role: 'player',
      });

    if (joinError) { toast.error('Failed to join tournament'); return null; }
    toast.success('Joined tournament!');
    return tournament;
  };

  const updateTournamentStatus = async (status: 'SETUP' | 'ACTIVE' | 'COMPLETE') => {
    if (!tournamentId) return;
    await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
    fetchTournament();
  };

  const addRound = async (courseData: Record<string, any>, gamesData: any[]) => {
    if (!tournamentId) return null;
    const roundNumber = rounds.length + 1;
    const { data, error } = await supabase
      .from('tournament_rounds')
      .insert({
        tournament_id: tournamentId,
        round_number: roundNumber,
        course_data: courseData,
        games_data: gamesData,
        status: 'SETUP',
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add round'); return null; }
    fetchTournament();
    return data as unknown as TournamentRound;
  };

  const updateRoundScores = async (roundId: string, scores: Record<string, any>) => {
    const { error } = await supabase
      .from('tournament_rounds')
      .update({ scores })
      .eq('id', roundId);
    if (error) toast.error('Failed to save scores');
  };

  const updateRoundPoints = async (roundId: string, pointsData: Record<string, any>) => {
    const { error } = await supabase
      .from('tournament_rounds')
      .update({ points_data: pointsData })
      .eq('id', roundId);
    if (error) toast.error('Failed to save points');
  };

  const updateRoundTeams = async (roundId: string, teamsData: any[]) => {
    const { error } = await supabase
      .from('tournament_rounds')
      .update({ teams_data: teamsData })
      .eq('id', roundId);
    if (error) toast.error('Failed to save teams');
  };

  const updateRoundStatus = async (roundId: string, status: 'SETUP' | 'ACTIVE' | 'COMPLETE') => {
    await supabase.from('tournament_rounds').update({ status }).eq('id', roundId);
    fetchTournament();
  };

  const setScorekeeper = async (roundId: string, userId: string) => {
    await supabase.from('tournament_rounds').update({ scorekeeper_id: userId }).eq('id', roundId);
    fetchTournament();
  };

  const removePlayer = async (playerId: string) => {
    await supabase.from('tournament_players').delete().eq('id', playerId);
    fetchTournament();
  };

  const isCreator = tournament?.creator_id === user?.id;

  return {
    tournaments,
    tournament,
    players,
    rounds,
    isLoading,
    myRole,
    isCreator,
    createTournament,
    joinTournament,
    updateTournamentStatus,
    addRound,
    updateRoundScores,
    updateRoundPoints,
    updateRoundTeams,
    updateRoundStatus,
    setScorekeeper,
    removePlayer,
    fetchTournament,
  };
};
