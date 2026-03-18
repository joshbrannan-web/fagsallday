

# Debounced Supabase Writes in `useRounds.tsx`

## Overview
Add a 3-second debounce for `scores` and `gameData` writes to Supabase, while keeping `status` and `course` writes immediate. This reduces database writes during rapid score entry without changing the optimistic UI behavior.

## Changes — `src/hooks/useRounds.tsx` only

### 1. Add refs (after line 71)
Add `pendingDbUpdatesRef` and `debounceTimerRef` refs for accumulating deferred writes and managing the timer.

### 2. Add `flushPendingUpdates` function (before `fetchRounds`, ~line 73)
Writes whatever is accumulated in `pendingDbUpdatesRef` to Supabase. On failure or offline, queues items to the sync queue. Resets the pending payload after reading it.

### 3. Replace `updateRound` body (lines 254–308)
- Optimistic local state update and offline cache remain identical
- **Deferred path** (scores/gameData): accumulates into `pendingDbUpdatesRef`, resets a 3s debounce timer
- **Immediate path** (status/course): flushes any pending deferred updates first, then writes status/course directly — ensures DB consistency when finishing/locking a round
- The `games` field handling is preserved in the deferred path alongside scores/gameData

No other files are modified.

