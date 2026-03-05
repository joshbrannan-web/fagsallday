

# Plan: Fix "Return to Hole" Tab Default & Tournament Score Sync

## Problem 1: Return to Hole Opens Tournament Tab
When "Return to Hole" is clicked from the Scorecard, the navigation state includes `tournamentGroupId`, so `ActiveRound` defaults `activeTab` to `'tournament'`. The user expects to land on the **betting** tab since they were viewing the scorecard (a betting-side feature).

## Problem 2: Scores Not Syncing to Tournament
The sync effect in `ActiveRound.tsx` (line 337) only syncs scores for `activeHole`. When the component remounts after navigation, it only syncs the current hole — all previously entered scores on other holes are not pushed to `tournament_hole_scores`.

## Fix

### 1. Add `preferredTab` to navigation state (`Scorecard.tsx`, `RoundSummary.tsx`)

Pass `preferredTab: 'betting'` in the navigation state from "Return to Hole" buttons so `ActiveRound` knows which tab to show.

**Scorecard.tsx** (lines 903-906, 1314-1316): Add `preferredTab: 'betting'` to the state object.

**RoundSummary.tsx** (line 598): Add `preferredTab: 'betting'` to the state object.

### 2. Use `preferredTab` in `ActiveRound.tsx` (line 68-70)

```tsx
const preferredTab = tournamentState.preferredTab as 'betting' | 'tournament' | undefined;
const [activeTab, setActiveTab] = useState<'betting' | 'tournament'>(
  preferredTab || (tournamentGroupId ? 'tournament' : 'betting')
);
```

### 3. Bulk-sync all existing scores on mount (`ActiveRound.tsx`, line 336-347)

Replace the `activeHole`-only sync with a mount-time sync that pushes **all** existing scores across all holes:

```tsx
useEffect(() => {
  if (!tournamentGroupId || !tournamentPlayerMapping || !currentRound) return;
  // Sync all holes, not just activeHole
  Object.entries(currentRound.scores).forEach(([holeStr, holeScores]) => {
    const holeNum = Number(holeStr);
    currentRound.players.forEach(player => {
      const score = holeScores[player.id];
      if (typeof score === 'number' && score > 0) {
        tournamentOverlay.syncScore(holeNum, player.id, score);
      }
    });
  });
}, [currentRound?.scores, tournamentGroupId, tournamentPlayerMapping]);
```

This ensures all hole scores are synced whenever scores change, not just the active hole.

| File | Change |
|---|---|
| `src/components/ActiveRound.tsx` | Use `preferredTab` from state; bulk-sync all holes |
| `src/components/Scorecard.tsx` | Add `preferredTab: 'betting'` to navigation state |
| `src/components/RoundSummary.tsx` | Add `preferredTab: 'betting'` to navigation state |

3 files changed, 0 database changes.

