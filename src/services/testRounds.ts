import { supabase } from '@/integrations/supabase/client';

/**
 * Test rounds are fully isolated practice rounds: they live in `tournament_groups`
 * with `is_test = true` and are excluded from every scoreboard / round-level
 * scoring read. Resetting wipes all of their data so a new test can be run.
 */
export async function fetchTestGroups(tournamentRoundId: string) {
  const { data } = await supabase
    .from('tournament_groups')
    .select('id, group_number, round_id, status')
    .eq('tournament_round_id', tournamentRoundId)
    .eq('is_test', true)
    .order('group_number');
  return data || [];
}

export async function resetTestRound(tournamentRoundId: string): Promise<number> {
  const groups = await fetchTestGroups(tournamentRoundId);
  if (groups.length === 0) return 0;

  const groupIds = groups.map(g => g.id);
  const roundIds = groups.map(g => g.round_id).filter(Boolean) as string[];

  await supabase.from('tournament_hole_scores').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_hole_results').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_group_players').delete().in('tournament_group_id', groupIds);
  await supabase.from('tournament_groups').delete().in('id', groupIds);

  if (roundIds.length > 0) {
    await supabase.from('round_participants').delete().in('round_id', roundIds);
    await supabase.from('rounds').delete().in('id', roundIds);
  }

  return groups.length;
}
