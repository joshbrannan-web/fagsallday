
CREATE OR REPLACE FUNCTION public.patch_round_scores(
  p_round_id UUID,
  p_hole INT,
  p_player_id TEXT,
  p_score INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rounds
  SET
    scores = jsonb_set(
      COALESCE(scores, '{}'::jsonb),
      ARRAY[p_hole::text, p_player_id],
      to_jsonb(p_score)
    ),
    updated_at = now()
  WHERE id = p_round_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_round_game_data(
  p_round_id UUID,
  p_game_id TEXT,
  p_hole INT,
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hole_data JSONB;
  merged JSONB;
BEGIN
  -- Get current hole-level data, defaulting to empty
  SELECT COALESCE(
    game_data -> p_game_id -> p_hole::text,
    '{}'::jsonb
  ) INTO current_hole_data
  FROM rounds WHERE id = p_round_id;

  -- Merge p_updates into existing hole data (p_updates wins on conflict)
  merged := current_hole_data || p_updates;

  UPDATE rounds
  SET
    game_data = jsonb_set(
      jsonb_set(
        COALESCE(game_data, '{}'::jsonb),
        ARRAY[p_game_id],
        COALESCE(game_data -> p_game_id, '{}'::jsonb)
      ),
      ARRAY[p_game_id, p_hole::text],
      merged
    ),
    updated_at = now()
  WHERE id = p_round_id;
END;
$$;
