CREATE OR REPLACE FUNCTION public.seed_service_role_secret(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'service_role_key';
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(p_value, 'service_role_key', 'Used by pg_cron to invoke edge functions');
  ELSE
    PERFORM vault.update_secret(existing_id, p_value, 'service_role_key', 'Used by pg_cron to invoke edge functions');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_service_role_secret(text) FROM PUBLIC, anon, authenticated;