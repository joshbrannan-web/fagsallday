import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ScoreboardConfig {
  id: string;
  name: string;
  scoreboard_type: string;
  display_order: number | null;
  show_round_breakdown: boolean | null;
  sort_direction: string | null;
  sort_metric: string;
}

export const useTournamentScoreboards = (tournamentId: string | undefined) => {
  const [scoreboards, setScoreboards] = useState<ScoreboardConfig[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [holeScores, setHoleScores] = useState<any[]>([]);
  const [holeResults, setHoleResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    const load = async () => {
      setIsLoading(true);
      const [sbRes, rndsRes, teamsRes, playersRes] = await Promise.all([
        supabase.from('tournament_scoreboards').select('*').eq('tournament_id', tournamentId).order('display_order'),
        supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
        supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId),
      ]);
      setScoreboards(sbRes.data || []);
      setRounds(rndsRes.data || []);
      setTeams(teamsRes.data || []);
      setPlayers(playersRes.data || []);
      setIsLive((rndsRes.data || []).some(r => r.status === 'active'));
      setIsLoading(false);
    };
    load();
  }, [tournamentId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase
      .channel(`tournament-scores-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_scores' }, () => {
        // Will re-fetch in Piece 6
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_results' }, () => {
        // Will re-fetch in Piece 6
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  return { scoreboards, rounds, teams, players, holeScores, holeResults, isLoading, isLive };
};
