
-- 1. Create round_participants table
CREATE TABLE public.round_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id)
);

-- Enable RLS
ALTER TABLE public.round_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: user can see their own participations
CREATE POLICY "Users can view their own participations"
  ON public.round_participants FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: round owner can see all participants of their rounds
CREATE POLICY "Round owners can view participants"
  ON public.round_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_participants.round_id
      AND rounds.user_id = auth.uid()
    )
  );

-- INSERT: only round owner can add participants
CREATE POLICY "Round owners can insert participants"
  ON public.round_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_participants.round_id
      AND rounds.user_id = auth.uid()
    )
  );

-- DELETE: only round owner can remove participants
CREATE POLICY "Round owners can delete participants"
  ON public.round_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_participants.round_id
      AND rounds.user_id = auth.uid()
    )
  );

-- 2. Add linked_user_id column to saved_players
ALTER TABLE public.saved_players
  ADD COLUMN linked_user_id UUID;

-- 3. Add RLS policy so participants can view rounds they played in
CREATE POLICY "Participants can view rounds they played in"
  ON public.rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.round_participants
      WHERE round_participants.round_id = rounds.id
      AND round_participants.user_id = auth.uid()
    )
  );

-- 4. Create search_users_by_name function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.search_users_by_name(search_term TEXT)
RETURNS TABLE(id UUID, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.display_name
  FROM public.profiles p
  WHERE p.display_name ILIKE '%' || search_term || '%'
  AND p.id != auth.uid()
  LIMIT 10;
$$;
