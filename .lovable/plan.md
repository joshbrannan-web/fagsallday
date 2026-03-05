

# Plan: Fix Tournament Score Sync Timing

## Problem
The bulk-sync effect in `ActiveRound.tsx` (line 338-350) runs immediately on mount, but `useTournamentOverlay`'s `syncScore` function checks `if (!tournamentGame) return` (line 339 of the hook). Since the overlay is still loading at that point, `tournamentGame` is null and every `syncScore` call silently bails out. The effect's dependencies (`currentRound?.scores`, `tournamentGroupId`, `tournamentPlayerMapping`) never change again, so the sync never retries.

## Fix

### `src/components/ActiveRound.tsx` — line 338-350

Add `tournamentOverlay.isLoading` to the effect's dependency array so it re-runs once the overlay finishes loading and `syncScore` is ready:

```tsx
useEffect(() => {
  if (!tournamentGroupId || !tournamentPlayerMapping || !currentRound) return;
  if (tournamentOverlay.isLoading) return; // Wait for overlay to be ready
  Object.entries(currentRound.scores).forEach(([holeStr, holeScores]) => {
    const holeNum = Number(holeStr);
    currentRound.players.forEach(player => {
      const score = holeScores[player.id];
      if (typeof score === 'number' && score > 0) {
        tournamentOverlay.syncScore(holeNum, player.id, score);
      }
    });
  });
}, [currentRound?.scores, tournamentGroupId, tournamentPlayerMapping, tournamentOverlay.isLoading]);
```

| File | Change |
|---|---|
| `src/components/ActiveRound.tsx` | Add `tournamentOverlay.isLoading` guard and dependency to bulk-sync effect |

1 file changed, 2 lines modified, 0 database changes.

