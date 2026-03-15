

# Fix: Scoreboard Not Showing Live Scores for Groups Without Computed Results

## Problem
Group 2 has 12 hole scores in the database (3 holes × 4 players) but **zero hole results**. The scoreboard relies entirely on `tournament_hole_results` for point calculations. When the player's active round overlay doesn't persist results (e.g., scores entered via admin scorecard, or overlay didn't trigger), the scoreboard shows "Not started" even though scores exist.

## Root Cause
Hole results are only persisted by:
1. `useTournamentOverlay` — runs in the player's active round (requires player to have tournament overlay active)
2. `useTournamentScorecard` — runs when admin uses `overrideScore`

If scores are synced but the overlay's engine never runs (or fails silently), no results are written. The scoreboard has no fallback.

## Fix: Backfill Missing Results in `useTournamentScoreboards`

Add a backfill step after fetching scores and results. For any group that has scores but no results, run the tournament engine and persist the computed results.

**File: `src/hooks/useTournamentScoreboards.ts`**

After `fetchScoresAndResults` completes, add a `backfillMissingResults` function that:

1. Identifies groups with scores but missing/fewer results
2. For each such group, assembles engine input from already-fetched data (games, players, groupPlayers, course holes from rounds, team_matchup)
3. Runs `calcTournamentHoleResults` from the tournament engine
4. Upserts the computed results to `tournament_hole_results`
5. Updates local state with the new results

This uses data already available in the hook (rounds with `course_data`, games, groupPlayers, players) — no additional fetches needed.

The backfill runs once after initial load and again whenever scores change via realtime. It's idempotent (upsert on `tournament_group_id, hole_number`).

## Technical Detail

```text
fetchAll()
  └─ fetchScoresAndResults(groupIds)
       └─ backfillMissingResults(scores, results, groups, games, players, groupPlayers, rounds)
            ├─ For each group: count scores vs results
            ├─ If scores > 0 && results < expected: run engine
            └─ Upsert computed results + update local state
```

Single file change in `useTournamentScoreboards.ts` — import `calcTournamentHoleResults` and add ~40 lines of backfill logic.

