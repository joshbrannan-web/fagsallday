ALTER TABLE public.tournament_rounds
  ADD COLUMN IF NOT EXISTS team_scoring_mode text NOT NULL DEFAULT 'per_round',
  ADD COLUMN IF NOT EXISTS team_scoring_points jsonb NOT NULL DEFAULT '{"round": 3, "front": 1, "back": 1, "overall": 2}'::jsonb;

ALTER TABLE public.tournament_rounds
  DROP CONSTRAINT IF EXISTS tournament_rounds_team_scoring_mode_check;

ALTER TABLE public.tournament_rounds
  ADD CONSTRAINT tournament_rounds_team_scoring_mode_check
  CHECK (team_scoring_mode IN ('per_hole', 'per_round', 'fbo'));

UPDATE public.tournament_rounds tr
SET team_scoring_points = jsonb_build_object(
      'round', COALESCE(t.custom_round_points, 3),
      'front', 1,
      'back', 1,
      'overall', 2
    )
FROM public.tournaments t
WHERE t.id = tr.tournament_id;