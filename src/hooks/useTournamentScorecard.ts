import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useTournamentScorecard = (groupId: string | undefined) => {
  const [scores, setScores] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  };

  return { scores, results, isLoading, overrideScore, refetch: fetchData };
};
