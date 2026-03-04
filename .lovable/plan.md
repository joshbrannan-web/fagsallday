

# Plan: Fix Tournament Round Delete — tournamentGroupId Not Found

## Root Cause

The `tournamentGroupId` in `RoundSummary.tsx` is sourced exclusively from `location.state` (line 118), which is only populated when navigating from the ActiveRound component. If the user reaches the Round Summary via any other path (e.g., loading from history, page refresh), `location.state` is empty and `tournamentGroupId` is `undefined`. This causes `handleDeleteRound` to skip the tournament cleanup and attempt to delete the round directly, which fails with a foreign key constraint error because `tournament_groups` still references the round.

The tournament group ID is already stored inside the round's `gameData` at `_TOURNAMENT_META.tournamentGroupId` — the code just needs to use it as a fallback.

## Fix

### `src/components/RoundSummary.tsx` (line 118)

Change the `tournamentGroupId` derivation to also check the round's embedded metadata:

```typescript
const tournamentGroupId = tournamentState?.tournamentGroupId 
  || currentRound?.gameData?.['_TOURNAMENT_META']?.tournamentGroupId;
```

This single-line change ensures the delete flow always finds the tournament group ID regardless of how the user navigated to the summary page. No other files or database changes needed.

| Resource | Change |
|---|---|
| `src/components/RoundSummary.tsx` | Fallback `tournamentGroupId` from `currentRound.gameData._TOURNAMENT_META` |

1 line changed, 0 new files, 0 database changes.

