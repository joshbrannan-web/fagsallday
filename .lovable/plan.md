

# Fix Optimistic Update Bug in Score Functions

## Problem
When authenticated, `currentRound` comes from `dbCurrentRound` (useRounds hook), not `localCurrentRound`. The current code calls `setLocalCurrentRound` for optimistic updates in the authenticated branch, which has no effect on the UI.

## Fix
In `src/App.tsx`, replace `setLocalCurrentRound(...)` in the authenticated branches of `updateScore`, `updateGameData`, and `updateGameDataBatch` with a non-awaited `updateRound(...)` call. This updates `dbCurrentRound` immediately for instant UI feedback. The RPC still handles the actual DB write; the `catch` block still awaits `updateRound` as fallback.

## Changes
**`src/App.tsx`** — replace the three functions (lines ~340–408) with the user-provided versions. The only meaningful diff in each function's authenticated branch:

```diff
- setLocalCurrentRound(prev => prev ? { ...prev, scores: newScores } : null);
+ updateRound(currentRound.id, { scores: newScores });
```

Same pattern for `updateGameData` and `updateGameDataBatch` with `gameData` instead of `scores`.

No other files changed.

