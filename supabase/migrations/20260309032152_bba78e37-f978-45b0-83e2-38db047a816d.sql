
DROP FUNCTION IF EXISTS public.get_saved_players_with_profiles(uuid);

CREATE FUNCTION public.get_saved_players_with_profiles(p_user_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, name text, handicap_index numeric, tee text, linked_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, ghin_number text, ghin_last_synced timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    sp.id, sp.user_id,
    COALESCE(p.display_name, sp.name) AS name,
    COALESCE(p.handicap_index, sp.handicap_index) AS handicap_index,
    sp.tee, sp.linked_user_id, sp.created_at, sp.updated_at,
    p.ghin_number,
    p.ghin_last_synced
  FROM public.saved_players sp
  LEFT JOIN public.profiles p ON sp.linked_user_id = p.id
  WHERE sp.user_id = p_user_id
  ORDER BY COALESCE(p.display_name, sp.name);
$function$;
