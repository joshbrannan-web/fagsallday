

# Fix: Side Game Changes Not Persisted Offline

## Problem
`queueUpdatesForSync` in `useRounds.tsx` handles `scores`, `gameData`, `status`, and `course` — but not `games`. If `changeGames` fires offline (or the Supabase write fails), the game list change is never queued for later sync.

Note: `changeGames` in `App.tsx` already calls `updateRound(currentRound.id, { games, scores, gameData })`, so no App.tsx changes are needed — the missing piece is just the queue and cache layer.

## Changes

### 1. `src/services/offlineStorage.ts`
- Add `'games'` to the `SyncQueueItem.type` union (line 19)
- Add `'games'` to `updateCachedRound` parameter type (line 46)

### 2. `src/hooks/useRounds.tsx`
- Add games handling to `queueUpdatesForSync` (after line 246):
```ts
if (updates.games !== undefined) {
  offlineStorage.addToSyncQueue({ roundId, type: 'games', data: { games_data: updates.games } });
}
```

Two lines changed, one line added. No App.tsx changes needed since `changeGames` already calls `updateRound` with `games`.

