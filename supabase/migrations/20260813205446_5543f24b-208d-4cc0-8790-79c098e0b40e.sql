ALTER TABLE public.tournament_rounds
  DROP CONSTRAINT IF EXISTS tournament_rounds_team_scoring_mode_check;

ALTER TABLE public.tournament_rounds
  ADD CONSTRAINT tournament_rounds_team_scoring_mode_check
  CHECK (team_scoring_mode IN ('per_hole', 'per_round', 'per_hole_and_round', 'fbo'));