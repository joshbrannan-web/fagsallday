ALTER TABLE public.tournament_registration_configs
  ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.tournament_registration_configs
  ALTER COLUMN amount DROP NOT NULL,
  ALTER COLUMN amount_label DROP NOT NULL,
  ALTER COLUMN venmo_link DROP NOT NULL;