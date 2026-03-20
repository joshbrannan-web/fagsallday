CREATE POLICY "Group members can write hole results"
  ON tournament_hole_results
  FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(tournament_group_id));

CREATE POLICY "Group members can update hole results"
  ON tournament_hole_results
  FOR UPDATE
  TO authenticated
  USING (is_group_member(tournament_group_id))
  WITH CHECK (is_group_member(tournament_group_id));