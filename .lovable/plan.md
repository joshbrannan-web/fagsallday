

# Fix: Halved Holes Not Counted in "Thru" Display

## Root Cause
In `GroupMatchesScoreboard.tsx` line 111, the `holesPlayed` counter uses `ppA > 0 || ppB > 0` to determine if a hole was played. When a hole is halved under the `no_points` rule, both players receive **0 points**, so the hole is silently skipped from the count. This makes "Thru N" display a lower number than actual holes completed.

**Example from live data:** Hole 1 for CB vs Josh was halved (both got 0 pts). Only Hole 2 (CB won, 1pt) was counted → "CB 1 UP · Thru 1" instead of correct "Thru 2".

## Fix
**File:** `src/components/scoreboards/GroupMatchesScoreboard.tsx` (line 108-114)

Change the `holesPlayed` counting to check whether the hole has a valid result (non-empty `result_label`) rather than checking if points are positive:

```typescript
// Before
groupResults.forEach((r: any) => {
  const ppA = r.player_points?.[sm.playerA] || 0;
  const ppB = r.player_points?.[sm.playerB] || 0;
  if (ppA > 0 || ppB > 0) holesPlayed++;
  aPts += ppA;
  bPts += ppB;
});

// After
groupResults.forEach((r: any) => {
  const ppA = r.player_points?.[sm.playerA];
  const ppB = r.player_points?.[sm.playerB];
  if (ppA !== undefined || ppB !== undefined) holesPlayed++;
  aPts += ppA || 0;
  bPts += ppB || 0;
});
```

This mirrors the same pattern already used correctly in `TournamentMatchStatusBar.tsx` (lines 86-91), where `!== undefined` is used instead of `> 0`.

One file, ~6 lines changed.

