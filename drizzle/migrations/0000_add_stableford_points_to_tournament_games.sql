ALTER TABLE public.tournament_games
  ADD COLUMN IF NOT EXISTS stableford_points jsonb;