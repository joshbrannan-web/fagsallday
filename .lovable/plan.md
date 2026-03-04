

# Plan: Fix Deleted Round Reappearing After Delete

## Root Cause

`deleteRound` in `src/hooks/useRounds.tsx` (line 304-329) clears the database record and in-memory state (`setCurrentRound(null)`, removes from `rounds` array), but does NOT call `offlineStorage.clearCachedRound()`. 

When the user navigates to `/`, the `RoundRecovery` component in `App.tsx` calls `offlineStorage.getCachedRound()`, finds the stale cached round with status `ACTIVE`, and immediately resumes it — making it appear as if the delete never happened.

## Fix

### `src/hooks/useRounds.tsx` — line 316

After `loadedRoundIdRef.current = null;`, add `offlineStorage.clearCachedRound();` inside the `deleteRound` function. This is a one-line addition.

```typescript
loadedRoundIdRef.current = null;
offlineStorage.clearCachedRound();  // <-- add this line
```

| File | Change |
|---|---|
| `src/hooks/useRounds.tsx` | Add `offlineStorage.clearCachedRound()` in `deleteRound` after clearing the loaded round ref |

1 line added, 0 new files, 0 database changes.

