import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Tournament } from '@/types/tournament';

interface TournamentRow {
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
  updated_at: string | null;
}

const mapRow = (r: any): Tournament => ({
  id: r.id,
  name: r.name,
  description: r.description || undefined,
  status: r.status as Tournament['status'],
  joinCode: r.join_code,
  numRounds: r.num_rounds,
  startDate: r.start_date || undefined,
  endDate: r.end_date || undefined,
  createdBy: r.created_by,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || '',
  teamScoringMethod: r.team_scoring_method || 'cumulative',
  customRoundPoints: r.custom_round_points ?? 3,
});

export interface CreateTournamentData {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  numRounds: number;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
  teams: { name: string; color: string; displayOrder: number }[];
  players: { displayName: string; handicapIndex: number; teamIndex: number; userId?: string }[];
  rounds: {
    roundNumber: number;
    name: string;
    courseData: any;
    roundDate?: string;
    notes?: string;
    game: {
      gameType: string;
      defaultPointsPerHole: number;
      halvedHoleRule: string;
      secondBallTiebreaker: boolean;
      useHandicaps: boolean;
      handicapAllowancePercent: number;
      maxScorePerHole?: number;
      sixesConfig?: any;
      rulesText?: string;
    };
    holePointOverrides?: { holeNumber: number; points: number }[];
    teamScoringMode?: 'per_hole' | 'per_round' | 'fbo';
    teamScoringPoints?: { round: number; front: number; back: number; overall: number };
  }[];
}

export const useTournaments = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTournaments = useCallback(async () => {
    if (!user) { setTournaments([]); setIsLoading(false); return; }
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); toast.error('Failed to load tournaments'); }
    else setTournaments((data || []).map(mapRow));
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const createTournament = async (input: CreateTournamentData): Promise<string | null> => {
    if (!user) return null;
    try {
      // 1. Insert tournament
      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          created_by: user.id,
          name: input.name,
          description: input.description || null,
          start_date: input.startDate || null,
          end_date: input.endDate || null,
          num_rounds: input.numRounds,
          status: 'setup',
          team_scoring_method: input.teamScoringMethod || 'cumulative',
          custom_round_points: input.customRoundPoints ?? 3,
        } as any)
        .select()
        .single();
      if (tErr || !tData) throw tErr || new Error('No tournament returned');

      const tournamentId = tData.id;

      // 2. Insert teams
      const teamInserts = input.teams.map(t => ({
        tournament_id: tournamentId,
        name: t.name,
        color: t.color,
        display_order: t.displayOrder,
      }));
      const { data: teamsData, error: teamsErr } = await supabase
        .from('tournament_teams')
        .insert(teamInserts)
        .select();
      if (teamsErr) throw teamsErr;

      const teamIds = (teamsData || []).map(t => t.id);

      // 3. Insert players
      const playerInserts = input.players.map(p => ({
        tournament_id: tournamentId,
        display_name: p.displayName,
        handicap_index: p.handicapIndex,
        team_id: teamIds[p.teamIndex] || null,
        user_id: p.userId || null,
      }));
      const { error: playersErr } = await supabase
        .from('tournament_players')
        .insert(playerInserts);
      if (playersErr) throw playersErr;

      // Auto-add linked players as tournament members so they pass RLS checks
      const linkedPlayers = input.players.filter(p => p.userId);
      const memberInserts = linkedPlayers.map(p => ({ tournament_id: tournamentId, user_id: p.userId! }));
      if (memberInserts.length > 0) {
        await supabase.from('tournament_members').upsert(memberInserts, {
          onConflict: 'tournament_id,user_id',
        });
      }

      // Cross-link all players with user_ids so they appear in each other's My Players
      if (linkedPlayers.length > 1) {
        const userIds = linkedPlayers.map(p => p.userId!);
        for (let i = 0; i < userIds.length; i++) {
          for (let j = i + 1; j < userIds.length; j++) {
            try {
              // Each RPC call links from caller→target; we need both directions
              // link_players_bidirectional creates a saved_player for the target user pointing to caller
              // So we call it once per pair — the RPC runs as the current user
              await supabase.rpc('link_players_bidirectional', { p_linked_user_id: userIds[j] });
            } catch (e) {
              console.warn('Failed to cross-link players:', e);
            }
          }
        }
      }

      // 4. Insert rounds + games + hole points
      for (const round of input.rounds) {
        const { data: roundData, error: roundErr } = await supabase
          .from('tournament_rounds')
          .insert({
            tournament_id: tournamentId,
            round_number: round.roundNumber,
            name: round.name,
            course_data: round.courseData,
            round_date: round.roundDate || null,
            notes: round.notes || null,
            status: 'pending',
            team_scoring_mode: round.teamScoringMode || 'per_round',
            team_scoring_points: round.teamScoringPoints || { round: 3, front: 1, back: 1, overall: 2 },
          } as any)
          .select()
          .single();
        if (roundErr || !roundData) throw roundErr || new Error('No round returned');

        const { data: gameData, error: gameErr } = await supabase
          .from('tournament_games')
          .insert({
            tournament_round_id: roundData.id,
            game_type: round.game.gameType,
            default_points_per_hole: round.game.defaultPointsPerHole,
            halved_hole_rule: round.game.halvedHoleRule,
            second_ball_tiebreaker: round.game.secondBallTiebreaker,
            use_handicaps: round.game.useHandicaps,
            handicap_allowance_percent: round.game.handicapAllowancePercent,
            max_score_per_hole: round.game.maxScorePerHole || null,
            sixes_config: round.game.sixesConfig || null,
            rules_text: round.game.rulesText || null,
          })
          .select()
          .single();
        if (gameErr || !gameData) throw gameErr;

        if (round.holePointOverrides && round.holePointOverrides.length > 0) {
          const hpInserts = round.holePointOverrides.map(hp => ({
            tournament_game_id: gameData.id,
            hole_number: hp.holeNumber,
            points: hp.points,
          }));
          const { error: hpErr } = await supabase
            .from('tournament_hole_points')
            .insert(hpInserts);
          if (hpErr) throw hpErr;
        }
      }

      // Auto-create default "Live Group Matches" scoreboard
      await supabase.from('tournament_scoreboards').insert({
        tournament_id: tournamentId,
        name: 'Live Group Matches',
        scoreboard_type: 'group_matches',
        display_order: 0,
        sort_metric: 'total_points',
        sort_direction: 'desc',
        show_round_breakdown: false,
      });

      await fetchTournaments();
      return tData.join_code;
    } catch (err: any) {
      console.error('Create tournament error:', err);
      toast.error(err.message || 'Failed to create tournament');
      return null;
    }
  };

  const updateTournament = async (id: string, updates: Partial<Pick<Tournament, 'name' | 'description' | 'status' | 'startDate' | 'endDate'>>) => {
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.startDate !== undefined) mapped.start_date = updates.startDate;
    if (updates.endDate !== undefined) mapped.end_date = updates.endDate;
    const { error } = await supabase.from('tournaments').update(mapped).eq('id', id);
    if (error) { toast.error('Failed to update tournament'); return; }
    await fetchTournaments();
  };

  return { tournaments, isLoading, createTournament, updateTournament, refetch: fetchTournaments };
};
