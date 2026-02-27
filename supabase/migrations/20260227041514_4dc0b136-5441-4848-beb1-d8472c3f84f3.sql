
-- Add unique constraint for bidirectional linking upsert
ALTER TABLE public.saved_players 
ADD CONSTRAINT saved_players_user_linked_unique UNIQUE (user_id, linked_user_id);

-- Bidirectional link function
CREATE OR REPLACE FUNCTION public.link_players_bidirectional(
  p_linked_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_name TEXT;
  caller_handicap NUMERIC;
BEGIN
  SELECT display_name, COALESCE(handicap_index, 0)
  INTO caller_name, caller_handicap
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.saved_players (user_id, name, handicap_index, tee, linked_user_id)
  VALUES (p_linked_user_id, COALESCE(caller_name, 'Unknown'), caller_handicap, 'White', auth.uid())
  ON CONFLICT ON CONSTRAINT saved_players_user_linked_unique
  DO UPDATE SET linked_user_id = auth.uid();
END;
$$;

-- Bidirectional unlink function
CREATE OR REPLACE FUNCTION public.unlink_players_bidirectional(
  p_linked_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.saved_players
  SET linked_user_id = NULL
  WHERE user_id = p_linked_user_id AND linked_user_id = auth.uid();
END;
$$;
