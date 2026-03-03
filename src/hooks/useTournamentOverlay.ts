import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OverlayState {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  holeResults: Record<number, { teamPoints: Record<string, number>; resultLabel?: string }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
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

  useEffect(() => {
    if (!tournamentGroupId) { setIsLoading(false); return; }
    const load = async () => {
      setIsLoading(true);
      // Get group → round → tournament to fetch teams
      const { data: group } = await supabase
        .from('tournament_groups')
        .select('tournament_round_id, team_matchup')
        .eq('id', tournamentGroupId)
        .single();

      if (!group) { setIsLoading(false); return; }

      const { data: round } = await supabase
        .from('tournament_rounds')
        .select('tournament_id')
        .eq('id', group.tournament_round_id)
        .single();

      if (!round) { setIsLoading(false); return; }

      const { data: teamsData } = await supabase
        .from('tournament_teams')
        .select('id, name, color')
        .eq('tournament_id', round.tournament_id);

      const teamsMap: Record<string, { name: string; color: string }> = {};
      (teamsData || []).forEach(t => { teamsMap[t.id] = { name: t.name, color: t.color }; });

      // Fetch existing hole results
      const { data: results } = await supabase
        .from('tournament_hole_results')
        .select('*')
        .eq('tournament_group_id', tournamentGroupId);

      const holeResults: Record<number, any> = {};
      const teamTotals: Record<string, number> = {};
      (results || []).forEach(r => {
        holeResults[r.hole_number] = {
          teamPoints: r.team_points as Record<string, number>,
          resultLabel: r.result_label,
        };
        const tp = r.team_points as Record<string, number>;
        Object.entries(tp).forEach(([tid, pts]) => {
          teamTotals[tid] = (teamTotals[tid] || 0) + (pts as number);
        });
      });

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

  // Sync score to tournament_hole_scores
  const syncScore = useCallback(async (
    holeNumber: number,
    roundPlayerId: string,
    grossScore: number,
  ) => {
    if (!tournamentGroupId || !playerMapping) return;
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

    // TODO (Piece 4): Recalculate tournament_hole_results for this hole
  }, [tournamentGroupId, playerMapping]);

  return { ...state, isLoading, syncScore };
};
