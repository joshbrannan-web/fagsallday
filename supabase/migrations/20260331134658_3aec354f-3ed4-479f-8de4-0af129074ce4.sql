
-- Generate share codes
CREATE OR REPLACE FUNCTION public.generate_registration_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS (SELECT 1 FROM public.tournament_registration_configs WHERE share_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Registration configs table
CREATE TABLE public.tournament_registration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  location text NOT NULL DEFAULT '',
  event_dates text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  amount_label text NOT NULL DEFAULT 'Deposit',
  venmo_link text NOT NULL DEFAULT '',
  google_sheet_id text,
  google_sheet_url text,
  is_open boolean NOT NULL DEFAULT true,
  share_code text NOT NULL UNIQUE DEFAULT generate_registration_share_code(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_registration_configs ENABLE ROW LEVEL SECURITY;

-- Admins CRUD their own configs
CREATE POLICY "Creator full access on registration configs"
  ON public.tournament_registration_configs FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- Anyone can read open configs (for the public registration page)
CREATE POLICY "Public can read open registration configs"
  ON public.tournament_registration_configs FOR SELECT
  TO anon, authenticated
  USING (is_open = true);

-- Registration entries table
CREATE TABLE public.tournament_registration_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.tournament_registration_configs(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  handicap_index numeric,
  ghin_number text,
  payment_confirmed boolean NOT NULL DEFAULT false,
  payment_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_registration_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can insert entries (public registration)
CREATE POLICY "Anyone can register"
  ON public.tournament_registration_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Config creator can read all entries for their configs
CREATE POLICY "Creator can read registration entries"
  ON public.tournament_registration_entries FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_registration_configs c
    WHERE c.id = config_id AND c.created_by = auth.uid()
  ));

-- Config creator can update entries
CREATE POLICY "Creator can update registration entries"
  ON public.tournament_registration_entries FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_registration_configs c
    WHERE c.id = config_id AND c.created_by = auth.uid()
  ));

-- Config creator can delete entries
CREATE POLICY "Creator can delete registration entries"
  ON public.tournament_registration_entries FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_registration_configs c
    WHERE c.id = config_id AND c.created_by = auth.uid()
  ));
