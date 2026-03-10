import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { GameSettings, Course, Player } from '@/types';
import { calculateCourseHandicap } from '@/services/gameEngine';
import { useApp } from '@/contexts/AppContext';

interface TournamentData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  join_code: string;
  num_rounds: number;
}

interface TournamentTeam {
  id: string;
  name: string;
  color: string;
  display_order: number | null;
}

interface TournamentPlayer {
  id: string;
  display_name: string;
  handicap_index: number;
  handicap_override: number | null;
  team_id: string | null;
  user_id: string | null;
}

interface TournamentRound {
  id: string;
  round_number: number;
  name: string | null;
  course_data: any;
  round_date: string | null;
  status: string;
  notes: string | null;
}

interface TournamentGame {
  id: string;
  game_type: string;
  default_points_per_hole: number;
  halved_hole_rule: string;
  second_ball_tiebreaker: boolean | null;
  use_handicaps: boolean | null;
  handicap_allowance_percent: number | null;
  max_score_per_hole: number | null;
  sixes_config: any;
  rules_text: string | null;
}

interface HolePoints {
  hole_number: number;
  points: number;
}

const GAME_TYPE_PLAYER_COUNT: Record<string, number> = {
  match_play_individual: 2,
  match_play_best_ball: 4,
  match_play_gross_best_ball: 4,
  blind_gross_best_ball: 4,
  scramble_2: 2,
  scramble_4: 4,
  alternate_shot_twosomes: 2,
  alternate_shot_foursomes: 4,
  tournament_sixes: 4,
};

const SCRAMBLE_TYPES = ['scramble_2', 'scramble_4'];

export const useTournamentRoundSetup = (tournamentId: string | undefined) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refetchRounds } = useApp();

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [allPlayers, setAllPlayers] = useState<TournamentPlayer[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [completedRoundCount, setCompletedRoundCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Wizard state
  const [selectedRound, setSelectedRound] = useState<TournamentRound | null>(null);
  const [tournamentGame, setTournamentGame] = useState<TournamentGame | null>(null);
  const [holePoints, setHolePoints] = useState<HolePoints[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<TournamentPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({});
  const [sideGames, setSideGames] = useState<GameSettings[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  // Pre-set groups from admin
  const [roundGroups, setRoundGroups] = useState<any[]>([]);
  const [roundGroupPlayers, setRoundGroupPlayers] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Duplicate group warnings
  const [groupedPlayerIds, setGroupedPlayerIds] = useState<Set<string>>(new Set());

  // Current user's tournament player + team
  const currentUserPlayer = allPlayers.find(p => p.user_id === user?.id);
  const currentUserTeam = teams.find(t => t.id === currentUserPlayer?.team_id);

  const requiredPlayerCount = tournamentGame
    ? GAME_TYPE_PLAYER_COUNT[tournamentGame.game_type] || 4
    : 4;

  const isScrambleFormat = tournamentGame
    ? SCRAMBLE_TYPES.includes(tournamentGame.game_type)
    : false;

  // Load tournament data
  useEffect(() => {
    if (!tournamentId) return;
    const load = async () => {
      setIsLoading(true);
      const [tRes, teamsRes, playersRes, roundsRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('display_order'),
        supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_number'),
      ]);
      setTournament(tRes.data);
      setTeams(teamsRes.data || []);
      setAllPlayers(playersRes.data || []);
      setRounds(roundsRes.data || []);
      setCompletedRoundCount((roundsRes.data || []).filter(r => r.status === 'completed').length);
      setIsLoading(false);
    };
    load();
  }, [tournamentId]);

  const selectRound = useCallback(async (round: TournamentRound) => {
    setSelectedRound(round);
    setSelectedGroupId(null);
    // Load game config
    const { data: game } = await supabase
      .from('tournament_games')
      .select('*')
      .eq('tournament_round_id', round.id)
      .maybeSingle();
    setTournamentGame(game);

    // Load hole points
    if (game) {
      const { data: points } = await supabase
        .from('tournament_hole_points')
        .select('hole_number, points')
        .eq('tournament_game_id', game.id)
        .order('hole_number');
      setHolePoints(points || []);
    }

    // Check for existing groups in this round (admin pre-set pairings)
    const { data: groups } = await supabase
      .from('tournament_groups')
      .select('*')
      .eq('tournament_round_id', round.id)
      .order('group_number');
    
    const allGroups = groups || [];
    setRoundGroups(allGroups);

    const groupIds = allGroups.map(g => g.id);
    if (groupIds.length > 0) {
      const { data: gp } = await supabase
        .from('tournament_group_players')
        .select('*')
        .in('tournament_group_id', groupIds);
      setRoundGroupPlayers(gp || []);
      setGroupedPlayerIds(new Set((gp || []).map(p => p.tournament_player_id)));
    } else {
      setRoundGroupPlayers([]);
      setGroupedPlayerIds(new Set());
    }

    // Pre-select current user
    if (user) {
      const currentPlayer = allPlayers.find(p => p.user_id === user.id);
      if (currentPlayer) {
        setSelectedPlayers([currentPlayer]);
        setTeamAssignments({ [currentPlayer.id]: currentPlayer.team_id || '' });
      }
    }
  }, [user, allPlayers]);

  const selectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    // Auto-populate selectedPlayers and teamAssignments from group data
    const gPlayers = roundGroupPlayers.filter(gp => gp.tournament_group_id === groupId);
    const players = gPlayers
      .map(gp => allPlayers.find(p => p.id === gp.tournament_player_id))
      .filter(Boolean) as TournamentPlayer[];
    setSelectedPlayers(players);
    const assignments: Record<string, string> = {};
    gPlayers.forEach(gp => {
      assignments[gp.tournament_player_id] = gp.team_id;
    });
    setTeamAssignments(assignments);
  }, [roundGroupPlayers, allPlayers]);

  const togglePlayer = useCallback((player: TournamentPlayer) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id);
      if (isSelected) {
        // Don't allow deselecting current user
        if (player.user_id === user?.id) return prev;
        const next = prev.filter(p => p.id !== player.id);
        setTeamAssignments(ta => {
          const copy = { ...ta };
          delete copy[player.id];
          return copy;
        });
        return next;
      }
      if (prev.length >= requiredPlayerCount) return prev;
      setTeamAssignments(ta => ({ ...ta, [player.id]: player.team_id || '' }));
      return [...prev, player];
    });
  }, [user, requiredPlayerCount]);

  const isPlayerAlreadyGrouped = useCallback((playerId: string) => {
    return groupedPlayerIds.has(playerId);
  }, [groupedPlayerIds]);

  const startRound = useCallback(async () => {
    if (!user || !tournament || !selectedRound || !tournamentGame) return;
    setIsStarting(true);

    try {
      const courseData = selectedRound.course_data as Course;
      const players: Player[] = selectedPlayers.map((tp, i) => ({
        id: (i + 1).toString(),
        name: tp.display_name,
        handicapIndex: tp.handicap_override ?? tp.handicap_index,
        courseHandicap: 0,
        tee: 'White',
        linkedUserId: tp.user_id || undefined,
      }));

      // Create the round
      const { data: newRound, error: roundError } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_data: courseData as any,
          players_data: players as any,
          games_data: sideGames as any,
          scores: {},
          game_data: {
            _TOURNAMENT_META: {
              tournamentId: tournament.id,
              tournamentName: tournament.name,
              roundNumber: selectedRound.round_number,
              roundName: selectedRound.name || `Round ${selectedRound.round_number}`,
              displayName: `${tournament.name} — Round ${selectedRound.round_number}`,
            },
          } as any,
          status: 'ACTIVE',
        })
        .select('id')
        .single();

      if (roundError || !newRound) throw roundError;

      // Insert round_participants for linked players
      const participantInserts = players
        .filter(p => p.linkedUserId)
        .map(p => ({
          round_id: newRound.id,
          user_id: p.linkedUserId!,
          player_name: p.name,
        }));
      if (participantInserts.length > 0) {
        await supabase.from('round_participants').insert(participantInserts);
      }

      // Build team matchup
      const teamIds = [...new Set(Object.values(teamAssignments).filter(Boolean))];
      const teamMatchup = teamIds.length === 2
        ? { teamAId: teamIds[0], teamBId: teamIds[1] }
        : null;

      let activeGroupId: string;

      if (selectedGroupId) {
        // Use pre-set group from admin — update it to active with round_id
        const { error: updateErr } = await supabase
          .from('tournament_groups')
          .update({ status: 'active', round_id: newRound.id })
          .eq('id', selectedGroupId);
        if (updateErr) throw updateErr;
        activeGroupId = selectedGroupId;
      } else {
        // Create new group (fallback when no admin pairings)
        const { count } = await supabase
          .from('tournament_groups')
          .select('id', { count: 'exact', head: true })
          .eq('tournament_round_id', selectedRound.id);

        const { data: newGroup, error: groupError } = await supabase
          .from('tournament_groups')
          .insert({
            tournament_round_id: selectedRound.id,
            group_number: (count || 0) + 1,
            team_matchup: teamMatchup as any,
            round_id: newRound.id,
            status: 'active',
          })
          .select('id')
          .single();

        if (groupError || !newGroup) throw groupError;
        activeGroupId = newGroup.id;

        // Create group players for new group
        const gpInserts = selectedPlayers.map(tp => ({
          tournament_group_id: activeGroupId,
          tournament_player_id: tp.id,
          team_id: teamAssignments[tp.id] || teams[0]?.id || '',
        }));
        await supabase.from('tournament_group_players').insert(gpInserts);
      }

      // Build player mapping for the overlay
      const pMapping = selectedPlayers.reduce((acc, tp, i) => {
        acc[(i + 1).toString()] = tp.id;
        return acc;
      }, {} as Record<string, string>);

      await supabase.from('rounds').update({
        game_data: {
          _TOURNAMENT_META: {
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            roundNumber: selectedRound.round_number,
            roundName: selectedRound.name || `Round ${selectedRound.round_number}`,
            tournamentGroupId: activeGroupId,
            displayName: `${tournament.name} — Round ${selectedRound.round_number}`,
            playerMapping: pMapping,
            teamMatchup,
          },
        } as any,
      }).eq('id', newRound.id);

      // Auto-activate tournament round if still pending
      if (selectedRound.status === 'pending') {
        await supabase
          .from('tournament_rounds')
          .update({ status: 'active' })
          .eq('id', selectedRound.id);
      }

      // Auto-activate tournament if still in setup
      if (tournament.status === 'setup') {
        await supabase
          .from('tournaments')
          .update({ status: 'active' })
          .eq('id', tournament.id);
      }

      await refetchRounds();

      toast.success('Round started! 🏌️');
      navigate('/active', {
        state: {
          tournamentGroupId: activeGroupId,
          tournamentName: tournament.name,
          tournamentRoundName: selectedRound.name || `Round ${selectedRound.round_number}`,
          playerMapping: pMapping,
          teamMatchup,
        },
      });
    } catch (err: any) {
      console.error('Failed to start round:', err);
      toast.error('Failed to start round');
    } finally {
      setIsStarting(false);
    }
  }, [user, tournament, selectedRound, tournamentGame, selectedPlayers, teamAssignments, sideGames, teams, navigate, selectedGroupId]);

  return {
    tournament,
    teams,
    allPlayers,
    rounds,
    completedRoundCount,
    isLoading,
    selectedRound,
    tournamentGame,
    holePoints,
    selectedPlayers,
    teamAssignments,
    sideGames,
    isStarting,
    currentUserPlayer,
    currentUserTeam,
    requiredPlayerCount,
    isScrambleFormat,
    roundGroups,
    roundGroupPlayers,
    selectedGroupId,
    selectRound,
    selectGroup,
    togglePlayer,
    setTeamAssignments,
    setSideGames,
    startRound,
    isPlayerAlreadyGrouped,
  };
};
