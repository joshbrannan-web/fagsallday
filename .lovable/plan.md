

# Verify Cached Round Exists Before Resuming

## Overview
When a tournament admin deletes a tournament (and its rounds), other players may still have a stale cached round in localStorage. The current recovery logic blindly resumes it, leading to a ghost round. Fix: verify the round exists in Supabase before resuming for authenticated users.

## Changes — `src/App.tsx` only

### 1. Make the useEffect callback async (line 73)
Change `() => {` to `async () => {`.

### 2. Replace the auto-resume block (lines 84–91)
Replace the current block with one that checks Supabase first for authenticated users:
- Query `rounds` table with `.maybeSingle()` for the cached round's ID
- If not found, call `offlineStorage.clearCachedRound()` and return silently
- If found, proceed with `loadPastRound` + navigate as before
- The unauthenticated path remains unchanged

### 3. Also update `handleResume` (line 98–107)
Apply the same validation to the recovery dialog's "Resume" button handler — make it async, verify the round exists, and if not, clear cache + dismiss dialog + show info toast instead of resuming.

No import changes needed — `supabase` is already imported in App.tsx.

