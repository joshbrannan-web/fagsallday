
-- Allow tournament members to create groups for rounds they participate in
CREATE POLICY "Members can create groups"
ON public.tournament_groups FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_rounds tr
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tr.id = tournament_groups.tournament_round_id
    AND tm.user_id = auth.uid()
  )
);

-- Allow tournament members to update their own groups (status → submitted)
CREATE POLICY "Members can update own groups"
ON public.tournament_groups FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournament_group_players tgp
    JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
    WHERE tgp.tournament_group_id = tournament_groups.id
    AND tp.user_id = auth.uid()
  )
);

-- Allow tournament members to add group players
CREATE POLICY "Members can create group players"
ON public.tournament_group_players FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tg.id = tournament_group_players.tournament_group_id
    AND tm.user_id = auth.uid()
  )
);
