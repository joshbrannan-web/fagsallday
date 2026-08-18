CREATE TABLE public.tournament_round_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_round_id uuid NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  match_number integer NOT NULL,
  side_a jsonb NOT NULL DEFAULT '[]'::jsonb,
  side_b jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_a_id uuid REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  team_b_id uuid REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_round_id, match_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_round_matches TO authenticated;
GRANT ALL ON public.tournament_round_matches TO service_role;

ALTER TABLE public.tournament_round_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view round matches"
ON public.tournament_round_matches FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tournament_rounds tr
  WHERE tr.id = tournament_round_id
    AND (public.is_tournament_member(tr.tournament_id)
      OR public.is_tournament_creator(tr.tournament_id)
      OR public.is_tournament_admin())
));

CREATE POLICY "Admins can manage round matches"
ON public.tournament_round_matches FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tournament_rounds tr
  WHERE tr.id = tournament_round_id
    AND (public.is_tournament_creator(tr.tournament_id) OR public.is_tournament_admin())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tournament_rounds tr
  WHERE tr.id = tournament_round_id
    AND (public.is_tournament_creator(tr.tournament_id) OR public.is_tournament_admin())
));

CREATE TRIGGER update_tournament_round_matches_updated_at
BEFORE UPDATE ON public.tournament_round_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tournament_hole_results
  ADD COLUMN tournament_match_id uuid REFERENCES public.tournament_round_matches(id) ON DELETE CASCADE;

ALTER TABLE public.tournament_hole_results
  ALTER COLUMN tournament_group_id DROP NOT NULL;

CREATE UNIQUE INDEX tournament_hole_results_match_hole_idx
  ON public.tournament_hole_results (tournament_match_id, hole_number)
  WHERE tournament_match_id IS NOT NULL;