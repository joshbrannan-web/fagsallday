ALTER TABLE public.tournament_groups ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournament_hole_results ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS tournament_groups_is_test_idx ON public.tournament_groups (tournament_round_id, is_test);
CREATE INDEX IF NOT EXISTS tournament_hole_results_is_test_idx ON public.tournament_hole_results (is_test);