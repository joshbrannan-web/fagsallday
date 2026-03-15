

# Offline-Resilient Tournament Score Sync

## Problem
Tournament scores are synced via direct `supabase.upsert()` in `useTournamentOverlay.syncScore`. When a group is offline, these calls fail silently. The existing offline sync queue (`fg_sync_queue`) only handles `rounds` table updates — it has no awareness of `tournament_hole_scores`.

When the group comes back online, the bulk-sync effect in `ActiveRound.tsx` (lines 337-351) re-pushes all scores from the local round state, which partially covers reconnection. But if the app restarts while offline, the local round state is only in `fg_offline_round` (the `rounds` table cache), and the tournament player mapping / group ID would need to be re-derived from the URL.

## Current Coverage
- **Local round scores**: Cached in `fg_offline_round`, sync queue targets `rounds` table — works.
- **Tournament scores on reconnect (same session)**: The bulk-sync `useEffect` in `ActiveRound` re-pushes all scores when `tournamentOverlay.isLoading` resolves — partially works.
- **Tournament scores on reconnect (app restart)**: Round recovery restores the cached round, navigates to `/active` with tournament params in URL. The bulk-sync effect fires again once overlay loads — partially works but fragile.

## What's Missing
1. `syncScore` fails silently offline — no retry, no queue.
2. No dedicated tournament score queue in localStorage.
3. No visibility into pending tournament syncs in the UI.
4. The backfill in `useTournamentScoreboards` covers the leaderboard side, but individual group results still need scores in the DB.

## Fix: Tournament-Aware Offline Queue

### 1. `src/services/offlineStorage.ts` — Add tournament sync queue

Add a separate `fg_tournament_sync_queue` with methods:
- `addTournamentScore(groupId, playerId, holeNumber, grossScore)`
- `getTournamentSyncQueue()`
- `removeTournamentSyncItems(ids)`
- `clearTournamentSyncQueue()`
- `getPendingTournamentSyncCount()`

Each item stores: `{ id, tournamentGroupId, tournamentPlayerId, holeNumber, grossScore, timestamp }`.

### 2. `src/hooks/useTournamentOverlay.ts` — Queue on failure

Update `syncScore` to:
1. Attempt the upsert.
2. On failure (network error), queue the score via `offlineStorage.addTournamentScore()`.
3. Log a warning instead of silently failing.

### 3. `src/hooks/useTournamentOverlay.ts` — Drain queue on reconnect

Add a new effect that watches `isOnline` (from `useOnlineStatus`). When transitioning to online:
1. Read `getTournamentSyncQueue()`.
2. For each item, upsert to `tournament_hole_scores`.
3. Remove successful items from the queue.
4. Call `reload()` to re-run the engine with fresh data.

### 4. `src/components/ConnectionStatusBar.tsx` — Show tournament pending count

Include `getPendingTournamentSyncCount()` in the pending count display so users see tournament scores waiting to sync.

### 5. `src/components/ActiveRound.tsx` — No changes needed

The existing bulk-sync effect already re-pushes all scores from local round state when the overlay finishes loading. Combined with the new queue drain, this provides double coverage.

## Summary of Changes

| File | Change |
|------|--------|
| `offlineStorage.ts` | Add tournament sync queue (~30 lines) |
| `useTournamentOverlay.ts` | Try/catch in `syncScore`, queue on fail; add reconnect drain effect (~25 lines) |
| `ConnectionStatusBar.tsx` | Include tournament pending count (~2 lines) |

