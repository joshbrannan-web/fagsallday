
-- Fix 1: Add permissive SELECT policy on tournaments for join-by-code lookup
CREATE POLICY "Authenticated users can find tournaments by code"
  ON public.tournaments
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix 2: Drop restrictive scorekeeper UPDATE policy and recreate as permissive
-- Also drop and recreate the creator ALL and participant SELECT as permissive
DROP POLICY IF EXISTS "Creator can manage rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Participants can view rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Scorekeeper can update scores" ON public.tournament_rounds;

CREATE POLICY "Creator can manage rounds"
  ON public.tournament_rounds
  FOR ALL
  TO authenticated
  USING (is_tournament_creator(tournament_id))
  WITH CHECK (is_tournament_creator(tournament_id));

CREATE POLICY "Participants can view rounds"
  ON public.tournament_rounds
  FOR SELECT
  TO authenticated
  USING (is_tournament_participant(tournament_id));

CREATE POLICY "Scorekeeper can update scores"
  ON public.tournament_rounds
  FOR UPDATE
  TO authenticated
  USING (is_round_scorekeeper(id));
