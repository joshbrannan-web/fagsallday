

## Problem

The `search_users_by_name` RPC only returns `id` and `display_name` — it does NOT return `handicap_index`. So when players are added via the "App Users" search path (as opposed to "My Players"), their handicap is hardcoded to `0`.

Evidence from the database: Austyn Whittenburg, Brandon Rodman, and Dallin Demke all have `handicap_index: 0` in `tournament_players` despite having real handicaps (13.5, 6.3, 6.4) in their `profiles`. These were added via the app user search which doesn't pull handicap data.

Players added from "My Players" (saved_players) work correctly because `useSavedPlayers` joins with `profiles` to get the current handicap.

### Two places this happens

1. **WizardStepPlayers.tsx line 126**: When adding from "App Users" search results, hardcodes handicap to `0`
2. **PlayerListAdmin.tsx line 49**: `handleAdd` also hardcodes `handicap_index: 0` when adding from search

### Fix

**Database function: `search_users_by_name`** — Update the RPC to also return `handicap_index` from profiles, so both the wizard and admin player list can use the real value.

```sql
CREATE OR REPLACE FUNCTION public.search_users_by_name(search_term text)
RETURNS TABLE(id uuid, display_name text, handicap_index numeric)
...
  SELECT p.id, p.display_name, COALESCE(p.handicap_index, 0) AS handicap_index
  FROM public.profiles p
  WHERE p.display_name ILIKE '%' || search_term || '%'
  AND p.id != auth.uid()
  LIMIT 10;
```

**WizardStepPlayers.tsx** — Use the returned handicap when adding from app user results:
- Line 126: Change `addPlayer(r.display_name || 'Unknown', 0, r.id)` → `addPlayer(r.display_name || 'Unknown', r.handicap_index ?? 0, r.id)`

**PlayerListAdmin.tsx** — Use the returned handicap when adding:
- Update `doSearch` results type to include `handicap_index`
- Line 49: Change `handicap_index: 0` → `handicap_index: r.handicap_index ?? 0` (pass handicap through `handleAdd`)

**Existing tournament data fix** — Run an UPDATE to backfill the 3 affected players in the current tournament from their profiles.

### Files Modified
- Database migration — update `search_users_by_name` return type
- `src/components/tournament-admin/WizardStepPlayers.tsx` — use handicap from search results
- `src/components/tournament-admin/PlayerListAdmin.tsx` — use handicap from search results
- Data update — backfill existing tournament players with correct handicaps

