

# Fix: Live Group Matches missing hole results

## Root Cause

The "My Game" view and the "Leaderboard > Live Group Matches" use **completely different data sources**:

- **My Game** (`useTournamentOverlay`): Runs the tournament engine **client-side** on raw `tournament_hole_scores` → always up-to-date because it re-computes on every score change
- **Live Group Matches** (`useTournamentScoreboards`): Reads **persisted** `tournament_hole_results` from the database → only shows results that have been written back

The problem: when a player enters a score via the normal gameplay flow, `syncScore()` in `useTournamentOverlay` only writes to `tournament_hole_scores`. It **never writes computed results to `tournament_hole_results`**. The only code that writes to `tournament_hole_results` is the admin scorecard override in `useTournamentScorecard.ts`.

So the leaderboard only has data for holes where the admin manually overrode a score.

## Fix

**`src/hooks/useTournamentOverlay.ts`** — Update `syncScore` to also run the engine and upsert computed results to `tournament_hole_results` after writing the score, mirroring the pattern already used in `useTournamentScorecard.overrideScore`:

1. After the existing `tournament_hole_scores` upsert in `syncScore`, trigger a `reload()` call
2. In `reload()`, after running the engine and updating local state, **also** upsert all computed `holeResults` to `tournament_hole_results` (the same upsert pattern from `useTournamentScorecard` lines 200-215)

This ensures every score entry from any player persists the latest engine results to the database, making them available to the scoreboards.

**1 file changed, 0 database changes.**

