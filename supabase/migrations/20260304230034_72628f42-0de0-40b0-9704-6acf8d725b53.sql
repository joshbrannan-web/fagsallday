-- Add DELETE RLS policies for tournament group data cleanup by group members

CREATE POLICY "Group members can delete their groups"
ON public.tournament_groups FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_groups.id
  AND tp.user_id = auth.uid()
));

CREATE POLICY "Group members can delete group players"
ON public.tournament_group_players FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp2
  JOIN tournament_players tp ON tp.id = tgp2.tournament_player_id
  WHERE tgp2.tournament_group_id = tournament_group_players.tournament_group_id
  AND tp.user_id = auth.uid()
));

CREATE POLICY "Group members can delete hole scores"
ON public.tournament_hole_scores FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_hole_scores.tournament_group_id
  AND tp.user_id = auth.uid()
));

CREATE POLICY "Group members can delete hole results"
ON public.tournament_hole_results FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_hole_results.tournament_group_id
  AND tp.user_id = auth.uid()
));