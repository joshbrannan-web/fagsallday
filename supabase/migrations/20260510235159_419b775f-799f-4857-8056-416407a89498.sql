CREATE OR REPLACE FUNCTION public.decrement_sheet_row_index(p_config_id uuid, p_above_row integer)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE tournament_registration_entries
  SET sheet_row_index = sheet_row_index - 1
  WHERE config_id = p_config_id
    AND sheet_row_index > p_above_row;
$$;