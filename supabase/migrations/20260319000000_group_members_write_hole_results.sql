-- Allow group members to insert and update tournament hole results
-- Previously only the tournament creator had write access (via "Creator full access" FOR ALL policy).
-- This caused silent failures for non-creator group members, leaving
-- the offline sync queue stuck ("Syncing 33 items" forever).

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
