DROP FUNCTION public.patch_round_scores(uuid, integer, text, integer);

CREATE FUNCTION public.patch_round_scores(
  p_round_id uuid,
  p_hole integer,
  p_player_id text,
  p_score integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_hole < 1 OR p_hole > 18 THEN
    RAISE EXCEPTION 'Hole number must be between 1 and 18';
  END IF;

  IF p_player_id IS NULL OR btrim(p_player_id) = '' THEN
    RAISE EXCEPTION 'Player ID is required';
  END IF;

  IF p_score < 1 OR p_score > 99 THEN
    RAISE EXCEPTION 'Score must be between 1 and 99';
  END IF;

  UPDATE public.rounds
  SET
    scores = jsonb_set(
      jsonb_set(
        COALESCE(scores, '{}'::jsonb),
        ARRAY[p_hole::text],
        COALESCE(scores -> p_hole::text, '{}'::jsonb),
        true
      ),
      ARRAY[p_hole::text, p_player_id],
      to_jsonb(p_score),
      true
    ),
    updated_at = now()
  WHERE id = p_round_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_round_scores(uuid, integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.patch_round_scores(uuid, integer, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.patch_round_scores(uuid, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patch_round_scores(uuid, integer, text, integer) TO service_role;