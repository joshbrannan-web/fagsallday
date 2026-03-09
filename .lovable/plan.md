

# Fix: Auto-show GHIN badge immediately after linking a player

## Problem
When a user links a new player to an app user, the `addPlayer` function inserts into `saved_players` and uses the raw insert response to update local state. This raw row doesn't include `ghin_number` or `ghin_last_synced` (those come from the joined `profiles` table via the RPC). So the GHIN badge won't appear until the user navigates away and back.

## Fix

**`src/hooks/useSavedPlayers.tsx`** — After a successful `addPlayer` with a `linkedUserId`, call `fetchPlayers()` (the existing refetch that uses the RPC) instead of manually appending the raw row to local state. This ensures the joined profile data (including GHIN fields) is immediately available.

Same fix for the link/unlink flows in `Players.tsx` — after updating `linked_user_id`, call `refetch()` to reload from the RPC.

### Changes

1. **`src/hooks/useSavedPlayers.tsx` — `addPlayer`**: After successful insert + reciprocal link, call `await fetchPlayers()` instead of `setSavedPlayers(prev => [...prev, data])`. Return the data as before.

2. **`src/pages/Players.tsx` — `handleLinkUser` callback and `handleUnlinkUser`**: After successful update, call `refetch()` from `useSavedPlayers` to reload the full joined data.

**2 files changed, 0 database changes.**

