# Fix local-cache vs. server drift

You're right that on-device storage is fighting the server. There are two separate mechanisms at play, and both are confirmed in the code.

## What I verified

**1. The offline round cache can resurrect data you deleted or changed elsewhere**

- `hydrateFromCache` (`src/hooks/useRounds.tsx`) takes every ACTIVE round loaded from the server and fills in any hole/player cell that exists in this device's cached copy but not on the server — then re-queues those cells to be written back to the database.
- There is no timestamp comparison. The cache has no notion of "the server copy is newer than mine." So a score you deleted online reappears on the phone and gets pushed back up.
- The cache is only cleared on the device that performs a delete/finish (`deleteRound`, `finishRound`). Another device holding the same round in `fg_offline_round` keeps it.
- On recovery, `loadPastRound(cached)` loads the whole cached round object (course, players, games, status) rather than the fresh server row, so config changes made online don't appear even though the round still exists.

**2. The service worker serves the previous app build first**

`public/sw.js` uses stale-while-revalidate for all same-origin assets, including `/` and `/index.html`. On the phone, the first load after a deploy renders the previous build from cache and only updates in the background — so a change can look like it "didn't take" until a second launch. `useVersionCheck` only reacts after the new build has actually loaded.

## The fix

**Cache freshness (round data)**

- Stamp the cache with the round's `updated_at` when writing it, and record a `cachedAt` time.
- On fetch, compare: if the server row's `updated_at` is newer than what the cache was based on, treat the server as authoritative and drop the cached copy for that round entirely instead of gap-filling.
- Only gap-fill from cache when the cache is at least as new as the server row, or when the device is offline / the write queue for that round is non-empty (the real offline case this exists for).
- Never re-queue cached cells when the cache is known-stale — that's the path that pushes deleted scores back to the database.

**Cache invalidation across devices**

- After a rounds fetch, if `fg_offline_round` holds a round id that is no longer in the user's server list (deleted elsewhere) or whose server status is no longer ACTIVE (finished/locked elsewhere), clear the cache and its queued sync items for that round.
- On recovery, re-read the round from the server and merge only queued-but-unsynced cells into it, rather than loading the cached object wholesale.

**App shell freshness**

- Switch navigation requests (`request.mode === 'navigate'` and `/index.html`) to network-first with cache fallback, so an online phone always gets the current build and the cache only kicks in offline. Hashed static assets stay stale-while-revalidate — they're immutable.
- Bump `CACHE_NAME` so existing devices drop the old shell.

**What stays the same**

Offline scoring is untouched: the write queue, in-round caching, and offline resume all keep working. The change is only about which copy wins when the device is online and the server has moved on.

## Technical notes

Files affected: `src/services/offlineStorage.ts` (add `updatedAt`/`cachedAt` metadata + per-round queue clearing), `src/hooks/useRounds.tsx` (`hydrateFromCache` freshness gate, post-fetch invalidation), `src/App.tsx` (recovery path reads the server row), `public/sw.js` (network-first navigations, cache version bump).

No database or edge-function changes.
