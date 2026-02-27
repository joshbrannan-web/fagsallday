

## Bidirectional Player Linking

### Problem
Currently, linking is one-directional. When User A links User B as a saved player, User B has no corresponding entry for User A. Both users should automatically see each other as linked.

### Changes

**1. Create a database function `link_players_bidirectional`** (migration)

A new `SECURITY DEFINER` function that:
- Takes the target `linked_user_id` as input
- Creates a reciprocal `saved_player` entry for the linked user (User B gets User A added to their saved players, linked back to User A)
- Uses `INSERT ... ON CONFLICT DO UPDATE` to handle cases where User B already has User A as a saved player (just sets the `linked_user_id`)
- Pulls the calling user's `display_name` and `handicap_index` from `profiles` to populate the reciprocal entry

```sql
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
  -- Get the calling user's profile info
  SELECT display_name, COALESCE(handicap_index, 0)
  INTO caller_name, caller_handicap
  FROM public.profiles
  WHERE id = auth.uid();

  -- Create reciprocal entry: the linked user gets the caller as a saved player
  INSERT INTO public.saved_players (user_id, name, handicap_index, tee, linked_user_id)
  VALUES (p_linked_user_id, COALESCE(caller_name, 'Unknown'), caller_handicap, 'White', auth.uid())
  ON CONFLICT ON CONSTRAINT saved_players_user_linked_unique
  DO UPDATE SET linked_user_id = auth.uid();
END;
$$;
```

**2. Add a unique constraint on `saved_players`** (same migration)

Add a unique constraint on `(user_id, linked_user_id)` to support the `ON CONFLICT` upsert and prevent duplicate linked entries:
```sql
ALTER TABLE public.saved_players 
ADD CONSTRAINT saved_players_user_linked_unique UNIQUE (user_id, linked_user_id);
```

Also add a unique partial index on `(user_id, lower(name))` where `linked_user_id IS NULL` to prevent duplicate unlinked players by name (optional safeguard).

**3. Create an `unlink_players_bidirectional` function** (same migration)

When User A unlinks User B, remove the `linked_user_id` from User B's corresponding saved player entry (or delete it):
```sql
CREATE OR REPLACE FUNCTION public.unlink_players_bidirectional(
  p_linked_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove the reciprocal link (set linked_user_id to null on the other side)
  UPDATE public.saved_players
  SET linked_user_id = NULL
  WHERE user_id = p_linked_user_id AND linked_user_id = auth.uid();
END;
$$;
```

**4. Update `src/hooks/useSavedPlayers.tsx`**

- In `addPlayer`: after inserting with a `linkedUserId`, call `supabase.rpc('link_players_bidirectional', { p_linked_user_id: linkedUserId })`
- In `updatePlayer`: when `linked_user_id` is being set to a new value, call `link_players_bidirectional`; when set to `null`, call `unlink_players_bidirectional` with the old `linked_user_id`

**5. Update `src/pages/Players.tsx`**

- In `handleUnlinkUser`: call `supabase.rpc('unlink_players_bidirectional', { p_linked_user_id: oldLinkedId })` before or after clearing the local link
- In the link dialog `onSelect`: after updating the player's `linked_user_id`, call `link_players_bidirectional`

No UI changes needed — both users will see the "Linked" badge because both now have reciprocal `saved_player` entries with `linked_user_id` set.

