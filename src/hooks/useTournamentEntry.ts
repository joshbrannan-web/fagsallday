import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TournamentResult {
  id: string;
  name: string;
  description: string | null;
  status: string;
  join_code: string;
  num_rounds: number;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string | null;
}

interface MyTournament extends TournamentResult {
  joined_at: string | null;
}

export const useTournamentEntry = () => {
  const { user } = useAuth();
  const [myTournaments, setMyTournaments] = useState<MyTournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lookupResult, setLookupResult] = useState<TournamentResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  const fetchMyTournaments = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    const { data: members } = await supabase
      .from('tournament_members')
      .select('tournament_id, joined_at')
      .eq('user_id', user.id);

    if (!members || members.length === 0) {
      setMyTournaments([]);
      setIsLoading(false);
      return;
    }

    const tournamentIds = members.map(m => m.tournament_id);
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)
      .order('created_at', { ascending: false });

    const result: MyTournament[] = (tournaments || []).map(t => {
      const member = members.find(m => m.tournament_id === t.id);
      return { ...t, joined_at: member?.joined_at || null };
    });
    setMyTournaments(result);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchMyTournaments(); }, [fetchMyTournaments]);

  const lookupTournament = async (code: string) => {
    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);
    setCreatorName(null);

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .ilike('join_code', code.toUpperCase())
      .maybeSingle();

    if (error || !data) {
      setLookupError('Tournament not found. Check your code and try again.');
      setIsLookingUp(false);
      return;
    }

    if (data.status === 'archived') {
      setLookupError('This tournament has ended.');
      setIsLookingUp(false);
      return;
    }

    setLookupResult(data);

    // Fetch creator name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', data.created_by)
      .maybeSingle();
    setCreatorName(profile?.display_name || 'Unknown');

    // Auto-join if not already a member
    if (user) {
      const { data: existing } = await supabase
        .from('tournament_members')
        .select('id')
        .eq('tournament_id', data.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('tournament_members').insert({
          tournament_id: data.id,
          user_id: user.id,
        });
        await fetchMyTournaments();
      }
    }

    setIsLookingUp(false);
  };

  const clearLookup = () => {
    setLookupResult(null);
    setLookupError(null);
    setCreatorName(null);
  };

  return {
    myTournaments,
    isLoading,
    lookupResult,
    lookupError,
    isLookingUp,
    creatorName,
    lookupTournament,
    clearLookup,
    refetch: fetchMyTournaments,
  };
};
