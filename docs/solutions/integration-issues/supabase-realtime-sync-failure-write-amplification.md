---
title: "Supabase Realtime cascading sync storm under concurrent multi-group play"
date: 2026-03-19
category: "integration-issues"
tags:
  - supabase-realtime
  - write-amplification
  - offline-queue
  - rls-policy
  - debounce
  - postgres-subscriptions
  - react-useeffect
  - cellular-connectivity
severity: critical
component: "tournament-scoring-sync"
symptoms:
  - "'Syncing 33 items' indicator never resolves"
  - "Hundreds of redundant database upserts per single score keystroke"
  - "App becomes unresponsive when 4+ groups play simultaneously"
  - "Scores entered by non-creator users silently fail to persist"
  - "Offline queue grows unbounded and never drains on spotty connections"
root_cause: "useEffect-driven sync wrote all 72 scores on any change, each triggering unfiltered Realtime events that called reload() without debounce, creating a cascading write storm; compounded by an RLS policy that silently rejected non-creator writes and an offline queue with no periodic drain, retry limit, or expiry"
resolution: "Replaced per-keystroke sync with per-hole-completion batch upserts, added 3s debounced and per-group filtered Realtime subscriptions, migrated RLS to allow group member writes, and implemented periodic (30s) offline queue drain with retry tracking and 24h/10-retry expiry"
---

# Supabase Realtime Cascading Sync Storm Under Concurrent Multi-Group Play

## Problem Description

A golf tournament scoring app broke down when 4 groups (16 players) played simultaneously on spotty cellular connections. Users saw a "Syncing 33 items" indicator that never cleared, scores from non-creator group members silently failed to persist, and the app became sluggish under concurrent usage.

Five compounding issues caused the failure:

1. **Write amplification loop** -- A `useEffect` in `ActiveRound.tsx` synced ALL scores (every player x every hole = ~72 upserts) on ANY score change. Each upsert fired a Supabase Realtime event that triggered `reload()`, which re-fetched all scores, re-ran the tournament engine, and upserted computed results -- generating more events. With 4 groups, one score entry cascaded into hundreds of DB operations.

2. **Unfiltered scoreboard subscriptions** -- `useTournamentScoreboards.ts` listened to `tournament_hole_scores` and `tournament_hole_results` with no Postgres-level filter. Every score change across the entire database hit every scoreboard subscriber.

3. **No debounce on `reload()`** -- Multiple rapid-fire Realtime events triggered concurrent `reload()` calls with no throttling, creating race conditions where stale results overwrote newer ones.

4. **RLS policy gap** -- Only the tournament creator had INSERT/UPDATE access to `tournament_hole_results`. Non-creator group members' upserts silently failed (Supabase returns empty data, not an error, for RLS-blocked upserts).

5. **Stuck offline queue** -- Failed items stayed in the queue permanently. The drain function only ran on `isOnline` state transitions (not periodically), had no retry logic, and no item expiry.

## Investigation Steps

1. Users reported "Syncing N items" badge never clearing, even after regaining connectivity.
2. Inspecting Supabase logs revealed RLS policy violations on `tournament_hole_results` for non-creator authenticated users.
3. Realtime channel analysis showed unfiltered subscriptions flooding all clients with cross-group events.
4. Profiling the scoring flow revealed that every individual score change triggered a direct DB write, which fired Realtime events, which triggered more writes -- a feedback loop.
5. The offline storage module had no queue for result payloads, no mechanism to expire stale items, and no retry logic.

## Root Cause Analysis

Three architectural problems combined:

**RLS gap**: The `tournament_hole_results` table only had a "Creator full access" `FOR ALL` policy. Group members who were not the tournament creator received silent write failures, causing items to accumulate in the offline queue forever.

**Architecture mismatch**: Writing individual scores to the DB on every keystroke, combined with Realtime subscriptions that triggered `reload()` on every change, created a feedback loop. The system needed a local-first approach with batched writes at natural sync points.

**Unfiltered Realtime**: Subscribing to table-wide `postgres_changes` without a `filter` clause meant every client received every row change across the entire database, multiplying bandwidth and processing costs.

## Solution

### 1. RLS Migration

Added INSERT and UPDATE policies for group members on `tournament_hole_results`:

```sql
CREATE POLICY "Group members can write hole results"
  ON tournament_hole_results FOR INSERT TO authenticated
  WITH CHECK (is_group_member(tournament_group_id));

CREATE POLICY "Group members can update hole results"
  ON tournament_hole_results FOR UPDATE TO authenticated
  USING (is_group_member(tournament_group_id))
  WITH CHECK (is_group_member(tournament_group_id));
```

**File:** `supabase/migrations/20260319000000_group_members_write_hole_results.sql`

### 2. Per-Hole Batch Sync

Replaced per-keystroke DB writes with a batch sync triggered on hole completion:

- **`syncScore()` became local-only** -- updates React state and marks previously-synced holes as dirty, no DB writes:

```typescript
const syncScore = useCallback(async (holeNumber, roundPlayerId, grossScore) => {
  // Mark hole dirty if it was previously synced
  if (syncedHolesRef.current.has(holeNumber)) {
    dirtyHolesRef.current.add(holeNumber);
  }
  // Update local state only
  setAllHoleScores(prev => { /* ... */ });
}, [tournamentGroupId, playerMapping, tournamentGame]);
```

- **`batchSyncHole()` added** -- syncs one hole's scores + engine results in a single batch, with admin override protection and offline queue fallback:

```typescript
const batchSyncHole = useCallback(async (holeNumber: number): Promise<boolean> => {
  // 1. Build score payloads for this hole only
  // 2. Check for admin overrides — skip overridden players
  // 3. Batch upsert scores (queue for offline retry on failure)
  // 4. Run engine and upsert results for this hole
  syncedHolesRef.current.add(holeNumber);
  dirtyHolesRef.current.delete(holeNumber);
  return true;
}, [/* deps */]);
```

- **Wired into `handleNextHole()`** as fire-and-forget (doesn't block UI):

```typescript
const handleNextHole = async () => {
  if (tournamentGroupId && !isReadOnly) {
    const completedHole = activeHole;
    tournamentOverlay.batchSyncHole(completedHole).catch(() => {});
    for (const dirtyHole of tournamentOverlay.getDirtyHoles()) {
      if (dirtyHole !== completedHole) {
        tournamentOverlay.batchSyncHole(dirtyHole).catch(() => {});
      }
    }
  }
  // ... advance to next hole ...
};
```

**Files:** `src/hooks/useTournamentOverlay.ts`, `src/components/ActiveRound.tsx`

### 3. Debounced, Filtered Realtime Subscription

Re-added the overlay's Realtime subscription with a 3-second trailing-edge debounce and Postgres-level filter:

```typescript
const debouncedReload = () => {
  if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  reloadTimerRef.current = setTimeout(() => reload(), 3000);
};
const channel = supabase
  .channel(`overlay-${tournamentGroupId}`)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'tournament_hole_scores',
    filter: `tournament_group_id=eq.${tournamentGroupId}`,
  }, debouncedReload)
  .subscribe();
```

**File:** `src/hooks/useTournamentOverlay.ts`

### 4. Per-Group Filtered Scoreboard Channels

Replaced single unfiltered channel with per-group filtered channels:

```typescript
groupIds.forEach(groupId => {
  supabase.channel(`scoreboard-${tournamentId}-${groupId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tournament_hole_scores',
      filter: `tournament_group_id=eq.${groupId}`,
    }, handleScoreChange)
    .subscribe();
});
```

**File:** `src/hooks/useTournamentScoreboards.ts`

### 5. Offline Queue Overhaul

Added results queue type, retry tracking, expiry, and periodic drain:

```typescript
// Expiry logic
function pruneExpired<T extends { timestamp: number; retryCount?: number }>(items: T[]): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (now - item.timestamp > 24 * 60 * 60 * 1000) return false; // 24h
    if ((item.retryCount ?? 0) >= 10) return false;
    return true;
  });
}

// 30s periodic drain (App.tsx)
drainAllTournamentQueues(); // Run immediately
const interval = setInterval(drainAllTournamentQueues, 30_000);
return () => clearInterval(interval);
```

**Files:** `src/services/offlineStorage.ts`, `src/App.tsx`, `src/components/ConnectionStatusBar.tsx`

## Key Design Decisions

1. **Local-first scoring, batch-sync per hole**: Scores live in React state during play. DB writes only happen on hole advancement. This eliminates per-keystroke network dependency.

2. **Fire-and-forget sync**: `batchSyncHole` is called with `.catch(() => {})` so hole advancement is never blocked by the network. The offline queue catches failures.

3. **Dirty-hole tracking**: Editing a previously-synced hole marks it dirty. On next hole advancement, all dirty holes are re-synced.

4. **Admin override protection**: `batchSyncHole` checks for `is_super_user_override = true` before upserting, so admin corrections are never overwritten.

5. **Bounded offline queues**: Items expire after 24 hours or 10 retries. Both scores and results have their own queues, drained every 30 seconds.

## Prevention Strategies

### Avoid Write Amplification Feedback Loops
- Never sync to DB on every keystroke. Debounce writes or batch at natural breakpoints.
- Guard Realtime event handlers against re-entrancy -- don't let incoming events trigger writes to the same table without a guard.
- Use local state as source of truth during editing; DB writes are background side-effects.

### Always Filter Realtime Subscriptions
- Always use Postgres-level `filter` on Realtime channels. Never subscribe to an entire table.
- Unsubscribe aggressively on unmount. Audit active channel count -- more than 3-5 per page is suspicious.

### Prevent Silent RLS Failures
- After every insert/update, verify the operation returned data. Empty array from an insert = RLS denial.
- Write integration tests that exercise CRUD under the exact auth context used by the client (not `service_role`).
- Maintain a policy inventory per table.

### Build Resilient Offline Queues
- Drain periodically (every 10-30s), not just on `online` state transition.
- Add TTL and max retry count. Stale items should expire, not accumulate forever.
- `navigator.onLine` only detects complete network loss -- use application-level heartbeats for degraded connectivity.

## Warning Signs

- **Write amplification**: DB operation counts spike exponentially relative to user actions. Browser Network tab shows burst of rapid-fire requests.
- **Unfiltered subscriptions**: Realtime callbacks fire for irrelevant changes. Performance degrades as total row count grows.
- **RLS silent failures**: Data saves successfully (no console error) but disappears on refresh. Insert returns empty array.
- **Broken offline queue**: "Syncing X items" indicator never resolves. Changes lost during brief connectivity drops.

## Related Documentation

- **Brainstorm:** `docs/brainstorms/2026-03-19-realtime-sync-fix-brainstorm.md`
- **Plan:** `docs/plans/2026-03-19-fix-realtime-sync-multi-group-tournament-plan.md`
- **Previous plan (superseded):** `.lovable/plan.md` (deferred all sync to round completion)
- **Related issues:** #59 (hole animation fix), #62 (unplayed holes after match complete)
- **Related pattern:** Working 3s debounce in `src/hooks/useRounds.tsx:72-108` -- the proven pattern replicated for tournament sync
