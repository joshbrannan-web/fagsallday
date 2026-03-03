DROP FUNCTION IF EXISTS public.search_users_by_name(text);

CREATE FUNCTION public.search_users_by_name(search_term text)
RETURNS TABLE(id uuid, display_name text, handicap_index numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.display_name, COALESCE(p.handicap_index, 0) AS handicap_index
  FROM public.profiles p
  WHERE p.display_name ILIKE '%' || search_term || '%'
  AND p.id != auth.uid()
  LIMIT 10;
$$;