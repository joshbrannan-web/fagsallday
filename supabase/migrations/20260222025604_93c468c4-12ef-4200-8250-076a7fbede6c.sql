
CREATE OR REPLACE FUNCTION public.is_round_owner(_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rounds
    WHERE id = _round_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Round owners can view participants" ON round_participants;
DROP POLICY IF EXISTS "Round owners can insert participants" ON round_participants;
DROP POLICY IF EXISTS "Round owners can delete participants" ON round_participants;

CREATE POLICY "Round owners can view participants"
  ON round_participants FOR SELECT
  USING (public.is_round_owner(round_id));

CREATE POLICY "Round owners can insert participants"
  ON round_participants FOR INSERT
  WITH CHECK (public.is_round_owner(round_id));

CREATE POLICY "Round owners can delete participants"
  ON round_participants FOR DELETE
  USING (public.is_round_owner(round_id));
