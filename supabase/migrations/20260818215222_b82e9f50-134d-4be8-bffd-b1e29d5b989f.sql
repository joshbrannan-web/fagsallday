ALTER TABLE public.tournament_round_matches
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_match_id uuid;

ALTER TABLE public.tournament_groups
  ADD COLUMN IF NOT EXISTS source_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_trm_round_is_test ON public.tournament_round_matches (tournament_round_id, is_test);
CREATE INDEX IF NOT EXISTS idx_tg_round_is_test ON public.tournament_groups (tournament_round_id, is_test);