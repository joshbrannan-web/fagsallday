CREATE OR REPLACE FUNCTION public.can_write_round_match(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_round_matches m
    JOIN tournament_rounds tr ON tr.id = m.tournament_round_id
    WHERE m.id = _match_id
      AND (
        public.is_tournament_creator(tr.tournament_id)
        OR public.is_tournament_admin()
        OR EXISTS (
          SELECT 1 FROM tournament_groups g
          WHERE g.tournament_round_id = tr.id
            AND public.is_group_member(g.id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_round_match(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_round_matches m
    JOIN tournament_rounds tr ON tr.id = m.tournament_round_id
    WHERE m.id = _match_id
      AND (
        public.is_tournament_member(tr.tournament_id)
        OR public.is_tournament_creator(tr.tournament_id)
        OR public.is_tournament_admin()
      )
  );
$$;

CREATE POLICY "Read match hole results"
ON public.tournament_hole_results
FOR SELECT TO authenticated
USING (tournament_match_id IS NOT NULL AND public.can_read_round_match(tournament_match_id));

CREATE POLICY "Write match hole results"
ON public.tournament_hole_results
FOR INSERT TO authenticated
WITH CHECK (tournament_match_id IS NOT NULL AND public.can_write_round_match(tournament_match_id));

CREATE POLICY "Update match hole results"
ON public.tournament_hole_results
FOR UPDATE TO authenticated
USING (tournament_match_id IS NOT NULL AND public.can_write_round_match(tournament_match_id))
WITH CHECK (tournament_match_id IS NOT NULL AND public.can_write_round_match(tournament_match_id));

CREATE POLICY "Delete match hole results"
ON public.tournament_hole_results
FOR DELETE TO authenticated
USING (tournament_match_id IS NOT NULL AND public.can_write_round_match(tournament_match_id));