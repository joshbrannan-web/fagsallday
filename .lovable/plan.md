

## Sync Linked Players' Handicaps from Profiles

### Problem

When a user updates their GHIN handicap, that change does **not** propagate to other users who have them as a linked player. The `saved_players` table stores a static snapshot of `handicap_index` — the `linked_user_id` reference exists but is never used to refresh the handicap.

### Solution

When fetching saved players in `useSavedPlayers.tsx`, join linked players against the `profiles` table to get the latest `handicap_index` and `display_name`. This way, every time the saved players list loads (round setup, My Players page), linked players automatically reflect the current handicap from the linked user's profile.

### Changes

**1. Create a database function** to fetch saved players with live profile data for linked players:

```sql
CREATE OR REPLACE FUNCTION public.get_saved_players_with_profiles(p_user_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, name text, handicap_index numeric, 
  tee text, linked_user_id uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT 
    sp.id, sp.user_id,
    COALESCE(p.display_name, sp.name) AS name,
    COALESCE(p.handicap_index, sp.handicap_index) AS handicap_index,
    sp.tee, sp.linked_user_id, sp.created_at, sp.updated_at
  FROM public.saved_players sp
  LEFT JOIN public.profiles p ON sp.linked_user_id = p.id
  WHERE sp.user_id = p_user_id
  ORDER BY COALESCE(p.display_name, sp.name);
$$;
```

This replaces static `handicap_index` with the linked user's live value when a `linked_user_id` exists, falling back to the stored value for unlinked players. It also keeps the display name in sync.

**2. Update `src/hooks/useSavedPlayers.tsx`**

Replace the `fetchPlayers` query from:
```typescript
const { data, error } = await supabase
  .from('saved_players')
  .select('*')
  .eq('user_id', user.id)
  .order('name');
```

To call the new database function:
```typescript
const { data, error } = await supabase
  .rpc('get_saved_players_with_profiles', { p_user_id: user.id });
```

No other code changes needed — the return shape is identical, so the Players page, Setup Wizard, and all downstream consumers work without modification.

