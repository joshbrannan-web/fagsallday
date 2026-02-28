
-- Create pending_round_links table
CREATE TABLE public.pending_round_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  claimed_by uuid,
  owner_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create validation trigger instead of CHECK constraint for expires_at
CREATE OR REPLACE FUNCTION public.validate_pending_round_link_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pending_round_link_expiry
  BEFORE INSERT OR UPDATE ON public.pending_round_links
  FOR EACH ROW EXECUTE FUNCTION public.validate_pending_round_link_expiry();

-- Enable RLS
ALTER TABLE public.pending_round_links ENABLE ROW LEVEL SECURITY;

-- Owner can insert
CREATE POLICY "Owner can insert pending links"
  ON public.pending_round_links FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Owner can select their own
CREATE POLICY "Owner can view own pending links"
  ON public.pending_round_links FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Authenticated users can select by round_id (to claim)
CREATE POLICY "Users can view pending links by round"
  ON public.pending_round_links FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can update claimed_by where it's null
CREATE POLICY "Users can claim unclaimed links"
  ON public.pending_round_links FOR UPDATE
  USING (auth.uid() IS NOT NULL AND claimed_by IS NULL)
  WITH CHECK (auth.uid() = claimed_by);
