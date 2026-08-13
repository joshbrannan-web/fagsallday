CREATE OR REPLACE FUNCTION public.update_linked_player_handicap(p_linked_user_id uuid, p_handicap numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_linked_user_id IS NULL THEN
    RAISE EXCEPTION 'Linked user is required';
  END IF;

  IF p_handicap IS NULL OR p_handicap < -10 OR p_handicap > 54 THEN
    RAISE EXCEPTION 'Handicap must be between -10 and 54';
  END IF;

  -- Caller must actually have this person saved and linked in their own list
  IF NOT EXISTS (
    SELECT 1 FROM public.saved_players
    WHERE user_id = auth.uid()
      AND linked_user_id = p_linked_user_id
  ) THEN
    RAISE EXCEPTION 'Player is not linked in your saved players';
  END IF;

  UPDATE public.profiles
  SET handicap_index = p_handicap
  WHERE id = p_linked_user_id;

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Keep every local copy of this linked player in sync
  UPDATE public.saved_players
  SET handicap_index = p_handicap
  WHERE user_id = auth.uid()
    AND linked_user_id = p_linked_user_id;

  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.update_linked_player_handicap(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_linked_player_handicap(uuid, numeric) TO authenticated;