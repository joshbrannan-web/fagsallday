DROP POLICY "Members can update own groups" ON public.tournament_groups;

CREATE POLICY "Members can update own groups"
ON public.tournament_groups
FOR UPDATE
TO authenticated
USING (is_group_member(id));