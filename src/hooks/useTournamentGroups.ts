import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useTournamentGroups = (roundId: string | undefined) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!roundId) { setIsLoading(false); return; }
    setIsLoading(true);
    const { data: gData } = await supabase
      .from('tournament_groups')
      .select('*')
      .eq('tournament_round_id', roundId)
      .eq('is_test', false)
      .order('group_number');
    setGroups(gData || []);

    const groupIds = (gData || []).map((g: any) => g.id);
    if (groupIds.length > 0) {
      const { data: gpData } = await supabase
        .from('tournament_group_players')
        .select('*')
        .in('tournament_group_id', groupIds);
      setGroupPlayers(gpData || []);
    }
    setIsLoading(false);
  }, [roundId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const updateGroupStatus = async (groupId: string, status: string) => {
    const updates: any = { status };
    if (status === 'submitted') updates.submitted_at = new Date().toISOString();
    const { error } = await supabase.from('tournament_groups').update(updates).eq('id', groupId);
    if (error) toast.error('Failed to update group');
    else await fetchGroups();
  };

  return { groups, groupPlayers, isLoading, updateGroupStatus, refetch: fetchGroups };
};
