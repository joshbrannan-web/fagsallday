---
title: "fix: Real-Time Sync for Multi-Group Tournament Play"
type: fix
status: completed
date: 2026-03-19
origin: docs/brainstorms/2026-03-19-realtime-sync-fix-brainstorm.md
---

# fix: Real-Time Sync for Multi-Group Tournament Play

## Overview

The tournament scoring app breaks down when 4 groups play simultaneously on spotty cellular connections. A single score entry cascades into hundreds of database operations via a write amplification feedback loop, unfiltered realtime subscriptions flood all clients, RLS policy gaps cause silent write failures, and stuck offline queue items show "Syncing 33 items" permanently.

The fix switches from per-keystroke tournament sync to per-hole-completion batch sync, while fixing 4 additional underlying bugs (unfiltered subscriptions, RLS gap, stuck queue, race conditions in `reload()`).

## Problem Statement

Five compounding issues cause sync failure (see brainstorm: `docs/brainstorms/2026-03-19-realtime-sync-fix-brainstorm.md`):

1. **Write amplification loop** — `ActiveRound.tsx:342-356` syncs ALL scores (every player x every hole = ~72 upserts) on ANY score change. Each upsert fires a Realtime event that triggers `reload()`, which fetches all scores, re-runs the engine, and upserts results — generating more events.
2. **Unfiltered scoreboard subscription** — `useTournamentScoreboards.ts:274` has no Postgres-level filter, so every score change database-wide hits every subscriber.
3. **No debounce on reload()** — `useTournamentOverlay.ts:76` has no throttle; concurrent `reload()` calls race and overwrite each other.
4. **RLS policy gap** — Only the tournament creator can write to `tournament_hole_results`. Non-creator upserts silently fail.
5. **Stuck offline queue** — Failed items stay in the queue permanently. Drain only runs on `isOnline` state transition, not on an interval. No retry logic.

## Proposed Solution

### Architecture Change: Per-Hole Batch Sync

Replace the per-keystroke sync with a batch sync triggered explicitly when the user taps "Next Hole" (or "Finish Round" on hole 18).

**During play:**
- `syncScore()` becomes local-only: updates React state and runs the tournament engine locally for instant feedback (match status, team standings). No DB writes.
- The existing per-keystroke `useEffect` at `ActiveRound.tsx:342-356` is removed entirely.

**On hole completion (user taps "Next Hole"):**
- A new `batchSyncHole()` function fires before advancing to the next hole.
- It batch-upserts all player scores for the completed hole to `tournament_hole_scores` in a single `.upsert([...])` call.
- It runs the tournament engine and upserts computed results to `tournament_hole_results`.
- If any operation fails (network or RLS), items are queued in the offline queue for retry.
- It also syncs any "dirty" previously-completed holes (scores edited after initial sync).

**On "Finish Round" (hole 18):**
- A final batch sync runs for hole 18 + any remaining dirty holes before navigating to the summary screen.

### Bug Fixes

- **Scoreboard filters:** Add Postgres-level `filter` to `useTournamentScoreboards.ts` subscriptions, one channel per group.
- **RLS fix:** New migration adding INSERT/UPDATE policy for group members on `tournament_hole_results`.
- **Debounce reload():** 3-second trailing-edge debounce on `reload()` in `useTournamentOverlay.ts`.
- **Queue retry:** Add 30-second periodic drain interval with exponential backoff. Add max 10 retries and 24-hour expiry. Extend offline queue to also handle `tournament_hole_results` payloads.

## Technical Approach

### Phase 1: RLS Policy Fix (Independent, deploy first)

A new Supabase migration to allow group members to write `tournament_hole_results`.

**File:** New migration in `supabase/migrations/`

```sql
-- Allow group members to insert and update tournament hole results
CREATE POLICY "Group members can write hole results"
  ON tournament_hole_results
  FOR ALL
  TO authenticated
  USING (is_group_member(tournament_group_id))
  WITH CHECK (is_group_member(tournament_group_id));
```

The `is_group_member()` function already exists (from migration `20260305000321`).

**Acceptance criteria:**
- [x] Non-creator group members can upsert to `tournament_hole_results`
- [x] Members of other groups still cannot write
- [x] Existing creator policy still works

---

### Phase 2: Core Sync Architecture Change

#### 2a. New `batchSyncHole()` function in `useTournamentOverlay.ts`

Replace the individual `syncScore()` DB writes with a batch function:

```typescript
// Pseudocode for batchSyncHole
async function batchSyncHole(holeNumber: number, scores: PlayerScores) {
  // 1. Build batch payload for tournament_hole_scores
  const scorePayloads = players
    .map(p => ({
      tournament_group_id: groupId,
      tournament_player_id: playerMapping[p.id],
      hole_number: holeNumber,
      gross_score: scores[p.id],
      is_super_user_override: false,
    }))
    .filter(p => p.gross_score > 0);

  // 2. Check for admin overrides — skip players whose scores were overridden
  const { data: existing } = await supabase
    .from('tournament_hole_scores')
    .select('tournament_player_id, is_super_user_override')
    .eq('tournament_group_id', groupId)
    .eq('hole_number', holeNumber)
    .eq('is_super_user_override', true);

  const overriddenPlayers = new Set(existing?.map(e => e.tournament_player_id));
  const filteredPayloads = scorePayloads.filter(p => !overriddenPlayers.has(p.tournament_player_id));

  // 3. Batch upsert scores
  const { error: scoreError } = await supabase
    .from('tournament_hole_scores')
    .upsert(filteredPayloads, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' });

  if (scoreError) {
    // Queue each score for offline retry
    filteredPayloads.forEach(p => offlineStorage.addTournamentScore(p.tournament_group_id, p.tournament_player_id, p.hole_number, p.gross_score));
    return;
  }

  // 4. Run engine and upsert results
  const engineResult = calcTournamentHoleResults(/* ... */);
  const resultPayloads = engineResult.holeResults
    .filter(hr => hr.holeNumber === holeNumber)
    .map(hr => ({ tournament_group_id: groupId, hole_number: hr.holeNumber, /* ... */ }));

  const { error: resultError } = await supabase
    .from('tournament_hole_results')
    .upsert(resultPayloads, { onConflict: 'tournament_group_id,hole_number' });

  if (resultError) {
    // Queue results for offline retry (new queue type)
    offlineStorage.addTournamentResult(groupId, resultPayloads);
  }
}
```

**Key design decisions:**
- **Explicit trigger (not reactive):** Sync fires on "Next Hole" tap, not automatically when `canAdvanceHole()` becomes true. This prevents premature sync while a player is correcting a typo. (see brainstorm: key decisions)
- **Admin override protection:** Check `is_super_user_override` before upserting to avoid overwriting admin corrections.
- **Capture hole number before advancing:** The completed hole number must be captured BEFORE `setActiveHole(h => h + 1)` runs.

#### 2b. Make `syncScore()` local-only in `useTournamentOverlay.ts`

Modify `syncScore()` (lines 362-387) to:
- Update local `allHoleScores` state
- Re-run the tournament engine locally (for instant match status feedback)
- Remove the `supabase.upsert` call and the `offlineStorage.addTournamentScore` fallback

#### 2c. Remove bulk-sync useEffect from `ActiveRound.tsx`

Delete the `useEffect` at lines 342-356 that iterates all scores and calls `syncScore()` on every change.

#### 2d. Wire `batchSyncHole()` into `handleNextHole()` in `ActiveRound.tsx`

Modify `handleNextHole()` (lines 401-419):

```typescript
const handleNextHole = async () => {
  const completedHole = activeHole; // Capture BEFORE advancing

  // Sync the completed hole + any dirty previous holes
  await tournamentOverlay.batchSyncHole(completedHole, currentRound.scores[completedHole]);
  for (const dirtyHole of tournamentOverlay.getDirtyHoles()) {
    await tournamentOverlay.batchSyncHole(dirtyHole, currentRound.scores[dirtyHole]);
  }

  if (activeHole === 18) {
    navigate('/summary');
  } else {
    setActiveHole(h => h + 1);
  }
};
```

#### 2e. Track "dirty" holes for score edits

Add a `dirtyHolesRef` to `useTournamentOverlay.ts` that tracks holes whose local scores differ from the last-synced scores. When a player navigates back and edits a previously completed hole, mark it dirty. On next hole advancement, sync all dirty holes.

**Acceptance criteria:**
- [x] Single score entry produces 0 DB writes (local-only)
- [x] Tapping "Next Hole" batch-syncs the completed hole's scores + engine results
- [x] Editing a previously synced hole marks it dirty and re-syncs on next advancement
- [x] Hole 18 "Finish Round" triggers final sync before navigating to summary
- [x] Admin-overridden scores are not overwritten by player sync
- [x] Offline failures queue items for retry

---

### Phase 3: Debounce `reload()` and Suppress Self-Triggers

#### 3a. Debounce `reload()` in `useTournamentOverlay.ts`

Add a 3-second trailing-edge debounce to `reload()` (line 76). Use a ref-based debounce pattern (matching the existing debounce in `useRounds.tsx:72-73`):

```typescript
const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const debouncedReload = useCallback(() => {
  if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  reloadTimerRef.current = setTimeout(() => reload(), 3000);
}, [reload]);
```

Wire the realtime subscription (line 349-357) to call `debouncedReload()` instead of `reload()`.

#### 3b. Remove `tournament_hole_results` upsert from `reload()`

Since `batchSyncHole()` now handles result upserts, remove the upsert at `useTournamentOverlay.ts:163-168` from `reload()`. The `reload()` function should only fetch and display — not write.

**Acceptance criteria:**
- [x] Rapid-fire realtime events collapse into a single `reload()` call
- [x] `reload()` is read-only (no upserts to `tournament_hole_results`)
- [x] No race conditions from concurrent `reload()` executions

---

### Phase 4: Filter Scoreboard Subscriptions

Modify `useTournamentScoreboards.ts:270-315` to use Postgres-level filters.

**Challenge:** The scoreboard watches ALL groups in a tournament. Supabase Realtime's `filter` parameter supports `eq` but `in` support for multiple IDs requires one channel per group.

**Solution:** Create one realtime channel per tournament group:

```typescript
// Instead of one unfiltered channel:
allGroupIds.forEach(groupId => {
  supabase.channel(`scoreboard-${tournamentId}-${groupId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tournament_hole_scores',
      filter: `tournament_group_id=eq.${groupId}`
    }, handleScoreChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tournament_hole_results',
      filter: `tournament_group_id=eq.${groupId}`
    }, handleResultChange)
    .subscribe();
});
```

With 4 groups, this creates 4 channels instead of 1 unfiltered channel — manageable and dramatically reduces unnecessary traffic.

**Acceptance criteria:**
- [x] Scoreboard only receives realtime events for groups in its tournament
- [x] Each group has its own filtered channel
- [x] Channels are cleaned up on unmount
- [x] Scoreboard still updates when any group in the tournament syncs a hole

---

### Phase 5: Fix Offline Queue

#### 5a. Add `tournament_hole_results` to the offline queue

Extend `offlineStorage.ts` with a new queue type:

```typescript
export interface TournamentResultQueueItem {
  id: string;
  tournamentGroupId: string;
  payload: Array<{ hole_number: number; team_points: any; player_points: any; result_label: string }>;
  timestamp: number;
  retryCount: number;
}
```

Add corresponding functions: `addTournamentResult()`, `getTournamentResultQueue()`, `removeTournamentResultItems()`.

#### 5b. Add retry logic with exponential backoff

Modify the drain functions in `App.tsx`:

```typescript
// Run drain every 30 seconds while online, not just on state transitions
useEffect(() => {
  if (!isOnline || !isAuthenticated) return;

  const drain = async () => {
    const queue = offlineStorage.getTournamentSyncQueue();
    for (const item of queue) {
      if (item.retryCount >= 10) {
        // Expired — remove from queue
        offlineStorage.removeTournamentSyncItems([item.id]);
        continue;
      }
      // Attempt with exponential backoff delay
      const { error } = await supabase.from('tournament_hole_scores').upsert(/* ... */);
      if (error) {
        offlineStorage.incrementRetryCount(item.id);
      } else {
        offlineStorage.removeTournamentSyncItems([item.id]);
      }
    }
    // Also drain tournament_hole_results queue (new)
  };

  drain(); // Run immediately
  const interval = setInterval(drain, 30_000); // Then every 30s
  return () => clearInterval(interval);
}, [isOnline, isAuthenticated]);
```

#### 5c. Add queue item expiry

Add `retryCount` and `timestamp` fields to queue items. Items older than 24 hours or with retryCount >= 10 are silently removed during drain.

#### 5d. Update `ConnectionStatusBar.tsx`

Include the new results queue count in the pending sync display:

```typescript
const pendingSyncCount = offlineStorage.getPendingSyncCount()
  + offlineStorage.getPendingTournamentSyncCount()
  + offlineStorage.getPendingTournamentResultCount(); // new
```

**Acceptance criteria:**
- [x] Failed score upserts are retried every 30 seconds
- [x] Failed result upserts are also queued and retried
- [x] Items expire after 24 hours or 10 retries
- [x] "Syncing X items" count decreases as items succeed or expire
- [x] Queue drains on app startup (not just on online transition)

---

## System-Wide Impact

### Interaction Graph

1. Player enters score → `updateScore()` in App.tsx → updates `currentRound.scores` → triggers 3s debounced write to `rounds` table (unchanged)
2. Score change → `syncScore()` (now local-only) → updates `allHoleScores` state → re-runs tournament engine locally → UI updates match status
3. User taps "Next Hole" → `handleNextHole()` → `batchSyncHole()` → batch upsert to `tournament_hole_scores` → engine run → upsert to `tournament_hole_results`
4. DB upserts → Supabase Realtime events → filtered to relevant group subscribers only → `debouncedReload()` on other clients → fetch + display (no writes)
5. Scoreboard receives per-hole Realtime events → updates standings display

### Error Propagation

- `batchSyncHole()` score upsert fails → items queued in `offlineStorage` → retried every 30s
- `batchSyncHole()` result upsert fails → results queued in new `offlineStorage` queue → retried every 30s
- `reload()` fetch fails → no state update, stale data displayed → next debounced reload retries automatically
- Queue drain fails repeatedly → items expire after 10 retries or 24 hours → removed silently

### State Lifecycle Risks

- **Partial batch sync:** If scores upsert succeeds but results upsert fails, scores exist in DB without computed results. Mitigation: results queue ensures eventual consistency. Other clients' `reload()` can also compute and write results.
- **Dirty hole tracking:** If app crashes between marking a hole dirty and syncing it, the dirty state is lost (it's in a ref). Mitigation: on round completion (`handleFinish`), do a full sync of ALL holes as a safety net.

### API Surface Parity

- `useTournamentOverlay.syncScore()` — changes from DB-writing to local-only (breaking change for any caller expecting DB persistence)
- `useTournamentOverlay.batchSyncHole()` — new function
- `useTournamentOverlay.getDirtyHoles()` — new function
- `offlineStorage` — new queue type for results, new `retryCount` field on existing items

## Acceptance Criteria

### Functional Requirements

- [x] Single score entry produces 0 tournament DB writes
- [x] Per-hole completion batch-syncs scores + results in ~5 DB operations (not ~72)
- [x] Scoreboard updates per-hole (not per-keystroke) with live-ish standings
- [x] Admin score overrides are preserved (not overwritten by player sync)
- [x] Non-creator group members can write tournament results (RLS fixed)
- [x] Offline queue drains every 30s with retry and expiry
- [x] "Syncing X items" resolves (items succeed or expire)
- [x] Score edits on previously completed holes are re-synced

### Non-Functional Requirements

- [x] 4 groups playing simultaneously: no cascading write amplification
- [x] Spotty connectivity: scores queue and drain without permanent stuckness
- [x] Scoreboard receives only relevant events (filtered by group)

### Quality Gates

- [x] Manual test: 4 browser tabs simulating 4 groups entering scores simultaneously
- [x] Verify Supabase dashboard shows ~5 DB operations per hole completion (not hundreds)
- [x] Verify "Syncing X items" resolves within 60s of regaining connectivity
- [x] Verify scoreboard updates when any group completes a hole

## Dependencies & Prerequisites

- Supabase migration must be deployed before code changes (Phase 1 before Phase 2)
- `is_group_member()` SQL function already exists

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase Realtime `eq` filter doesn't support all ID formats | Low | Medium | Test with actual group IDs; fall back to client-side filtering if needed |
| Per-hole sync feels too delayed for users | Low | Low | Per-hole is a natural breakpoint; users won't notice ~1s sync on advancement |
| Partial batch sync leaves inconsistent state | Medium | Medium | Results queue + full sync on round completion as safety net |
| Admin override check adds latency to sync | Low | Low | Single SELECT query; can be cached if needed |

## Files to Modify

| File | Change | Phase |
|------|--------|-------|
| New migration | RLS policy for `tournament_hole_results` | 1 |
| `src/hooks/useTournamentOverlay.ts` | Local-only `syncScore()`, new `batchSyncHole()`, debounced `reload()`, dirty hole tracking, remove results upsert from `reload()` | 2, 3 |
| `src/components/ActiveRound.tsx` | Remove bulk-sync useEffect, wire `batchSyncHole()` into `handleNextHole()` | 2 |
| `src/hooks/useTournamentScoreboards.ts` | Per-group filtered channels | 4 |
| `src/services/offlineStorage.ts` | New results queue type, `retryCount` field, expiry logic | 5 |
| `src/App.tsx` | 30s drain interval, exponential backoff, drain results queue | 5 |
| `src/components/ConnectionStatusBar.tsx` | Include results queue in pending count | 5 |

## Files NOT to Modify

- `src/hooks/useRounds.tsx` — Round-level 3s debounce works correctly
- `src/services/tournamentEngine.ts` — Engine logic is correct, just called too often
- `src/components/RoundSummary.tsx` — Already handles tournament submission on finish

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-19-realtime-sync-fix-brainstorm.md](docs/brainstorms/2026-03-19-realtime-sync-fix-brainstorm.md) — Key decisions carried forward: per-hole completion sync trigger, local-first during play, fix all 5 underlying issues

### Internal References

- Working debounce pattern: `src/hooks/useRounds.tsx:72-108`
- Hole completion detection: `src/components/ActiveRound.tsx:394-399`
- Write amplification root: `src/components/ActiveRound.tsx:342-356`
- Reload with race conditions: `src/hooks/useTournamentOverlay.ts:76-171`
- Unfiltered subscriptions: `src/hooks/useTournamentScoreboards.ts:270-315`
- RLS policies: `supabase/migrations/20260302042259_...sql:410-427`
- `is_group_member()` function: `supabase/migrations/20260305000321_...sql`
- Offline queue: `src/services/offlineStorage.ts`
- Queue drain: `src/App.tsx:226-293`
- Previous (superseded) plan: `.lovable/plan.md`
