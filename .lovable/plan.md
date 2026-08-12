# Harden the round-score offline sync queue

The round-score queue (`fg_sync_queue`) currently drains only when the browser fires an `online` event. On degraded cellular, where the browser still reports "online", queued scores can sit unsent for a whole round, and nothing refreshes the round after a sync.

## What changes

**1. Queue storage (`src/services/offlineStorage.ts`)**
- Add optional `retryCount` and `lastAttempt` to `SyncQueueItem`.
- Add a 7-day age limit constant for this queue (`MAX_AGE_MS_ROUND`), separate from the 24h tournament limit.
- `getSyncQueue` filters out items only by age — never by retry count.
- New `incrementSyncRetry(id)` records an attempt and timestamp on an item.

**2. Drain loop (`src/App.tsx`)**
- Extract the sync body into a `syncPendingChanges` callback guarded by a `syncInFlightRef` so runs cannot overlap.
- Per-item exponential backoff: 20s doubling up to a 5-minute cap, based on `retryCount` / `lastAttempt`.
- `scorePatch` items call `patch_round_scores`; success removes the item, a Postgres-level rejection (error code, or `false` return) is dropped with a logged message, anything else is treated as a transport failure and retried.
- `scores` / `gameData` items keep the existing server-merge step before updating, so a replayed snapshot can never delete holes recorded elsewhere.
- Failures increment the retry counter instead of dropping the item.
- After a successful pass, `refetchRounds()` pulls merged server state back into the UI; permanently rejected items surface an error toast.
- The effect runs the drain immediately and then on a 20s interval, plus on `visibilitychange`, `focus`, and `online`. It no longer gates on `isOnline`.
- The tournament queue drain effect is untouched.

**3. Debounce safety net (`src/hooks/useRounds.tsx`)**
- Track the round id for the pending debounced payload in a new `pendingRoundIdRef`, set in the deferred branch of `updateRound`.
- On `pagehide` / tab hidden, cancel the debounce timer and park the un-flushed payload into the offline queue as `scores` / `gameData` / `games` items, so a backgrounded or killed PWA never loses that window.

## Explicitly out of scope
No database migration, no changes to database functions, no changes to the tournament queues, no changes to score entry in ActiveRound, and no retry cap that discards items after N network failures.
