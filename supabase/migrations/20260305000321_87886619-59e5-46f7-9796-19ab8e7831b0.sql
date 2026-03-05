-- Step 1: Create SECURITY DEFINER helper function
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_group_players tgp
    JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
    WHERE tgp.tournament_group_id = _group_id
      AND tp.user_id = auth.uid()
  )
$$;

-- Step 2: Replace DELETE policies

-- tournament_group_players
DROP POLICY IF EXISTS "Group members can delete group players" ON tournament_group_players;
CREATE POLICY "Group members can delete group players" ON tournament_group_players
FOR DELETE TO authenticated
USING (is_group_member(tournament_group_id));

-- tournament_groups
DROP POLICY IF EXISTS "Group members can delete their groups" ON tournament_groups;
CREATE POLICY "Group members can delete their groups" ON tournament_groups
FOR DELETE TO authenticated
USING (is_group_member(id));

-- tournament_hole_results
DROP POLICY IF EXISTS "Group members can delete hole results" ON tournament_hole_results;
CREATE POLICY "Group members can delete hole results" ON tournament_hole_results
FOR DELETE TO authenticated
USING (is_group_member(tournament_group_id));

-- tournament_hole_scores
DROP POLICY IF EXISTS "Group members can delete hole scores" ON tournament_hole_scores;
CREATE POLICY "Group members can delete hole scores" ON tournament_hole_scores
FOR DELETE TO authenticated
USING (is_group_member(tournament_group_id));