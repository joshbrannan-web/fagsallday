DROP FUNCTION IF EXISTS public.patch_round_game_data(uuid, text, integer, jsonb);

CREATE FUNCTION public.patch_round_game_data(
  p_round_id uuid,
  p_game_id text,
  p_hole integer,
  p_updates jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hole_data jsonb;
  merged jsonb;
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_hole < 0 OR p_hole > 18 THEN
    RAISE EXCEPTION 'Hole number out of range';
  END IF;

  IF p_game_id IS NULL OR btrim(p_game_id) = '' THEN
    RAISE EXCEPTION 'Game ID is required';
  END IF;

  SELECT COALESCE(game_data -> p_game_id -> p_hole::text, '{}'::jsonb)
    INTO current_hole_data
    FROM public.rounds
   WHERE id = p_round_id AND user_id = auth.uid();

  merged := COALESCE(current_hole_data, '{}'::jsonb) || p_updates;

  UPDATE public.rounds
     SET game_data = jsonb_set(
           jsonb_set(
             COALESCE(game_data, '{}'::jsonb),
             ARRAY[p_game_id],
             COALESCE(game_data -> p_game_id, '{}'::jsonb),
             true
           ),
           ARRAY[p_game_id, p_hole::text],
           merged,
           true
         ),
         updated_at = now()
   WHERE id = p_round_id AND user_id = auth.uid();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_round_game_data(uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.patch_round_game_data(uuid, text, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.patch_round_game_data(uuid, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patch_round_game_data(uuid, text, integer, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';