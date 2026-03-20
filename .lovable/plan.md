

# Defer Tournament Sync to Round Completion

## Problem
Live tournament syncing (`syncScore` on every keystroke, realtime subscriptions, and hole-result upserts during play) causes failures that block groups from entering scores.

## Solution
Remove all live tournament database writes during an active round. Instead, batch-sync all scores and computed results to the tournament tables only when the round owner clicks "Complete Round" in `RoundSummary`.

## Changes

### 1. `src/hooks/useTournamentOverlay.ts` — Remove live writes, keep local engine

- **Remove the realtime subscription** (lines 348-359) — the `overlay-${tournamentGroupId}` channel that triggers `reload()` on every score change
- **Remove the `tournament_hole_results` upsert** inside `reload()` (lines 150-168) — stop persisting results on every score change
- **Change `syncScore`** to be local-only: instead of upserting to `tournament_hole_scores`, just update the local `allHoleScores` state and re-run the engine. This keeps the tournament tab UI (match tracker, points) working locally without any DB writes
- **Add a new `batchSyncAllScores` function** that:
  1. Upserts all scores from `allHoleScores` to `tournament_hole_scores`
  2. Re-runs the engine and upserts all computed results to `tournament_hole_results`
  3. Returns success/failure so the caller can handle errors
- **Expose `batchSyncAllScores`** in the return object

### 2. `src/components/ActiveRound.tsx` — Remove bulk-sync effect

- **Remove the `useEffect` at lines 342-356** that bulk-syncs scores to `tournament_hole_scores` whenever `currentRound.scores` changes. This is the main source of live DB writes during play.

### 3. `src/components/RoundSummary.tsx` — Add batch sync on completion

- In `handleFinish()`, before setting status to `submitted`, call `tournamentOverlay.batchSyncAllScores()` using the overlay hook
- The overlay hook needs to be accessible here — it's already used via `TournamentRoundSummary`. We'll either:
  - Pass `batchSyncAllScores` down from `ActiveRound` via navigation state, OR
  - Instantiate `useTournamentOverlay` in `RoundSummary` directly (it already has `tournamentGroupId` from location state)
- Best approach: instantiate `useTournamentOverlay` in `RoundSummary` with the same params, call `batchSyncAllScores()` in `handleFinish`, show a loading spinner during sync, and handle errors with a retry toast

### 4. `src/services/offlineStorage.ts` — Keep tournament offline queue

The offline queue (`fg_tournament_sync_queue`) becomes less relevant since we're not writing during play, but keep it as a safety net for the batch sync in case it partially fails.

## Flow After Changes

```text
During Round:
  Player enters score → updateScore (local round) → engine runs locally
  Tournament tab shows live match status from local calculation
  NO database writes to tournament tables

On "Complete Round":
  handleFinish() in RoundSummary
    ├── batchSyncAllScores()
    │     ├── Upsert ALL scores → tournament_hole_scores
    │     └── Upsert ALL results → tournament_hole_results
    ├── Update tournament_groups.status = 'submitted'
    ├── finishRound() (marks betting round complete)
    └── Navigate home
```

## What Still Works
- Tournament tab in ActiveRound still shows live match status (calculated locally from round scores)
- Tournament overlay animations (hole completion banners) still work locally
- Admin scoreboards update once the group completes their round
- Segment totals for Sixes still compute locally

| File | Change |
|---|---|
| `src/hooks/useTournamentOverlay.ts` | Remove realtime sub + live upserts, add `batchSyncAllScores`, make `syncScore` local-only |
| `src/components/ActiveRound.tsx` | Remove bulk-sync useEffect |
| `src/components/RoundSummary.tsx` | Call `batchSyncAllScores()` in `handleFinish` before submission |

3 files changed, 0 database changes.

