

# Plan: Add Tournament Game Scores to Scorecard View

## Context
The Scorecard view currently shows all betting game summaries (Banker, FBO, Stockton 6's, etc.) but does not display tournament match results. When a round is linked to a tournament (via `_TOURNAMENT_META` in `gameData`), players have no way to see their tournament game status from the Scorecard.

## Approach
Add a tournament match summary section at the end of the betting games section in `Scorecard.tsx`, using the existing `useTournamentOverlay` hook and `TournamentMatchTracker` component — the same pattern used by `TournamentRoundSummary`.

## Changes

### `src/components/Scorecard.tsx`
1. Import `useTournamentOverlay` and `TournamentMatchTracker` (plus `Trophy` icon, already imported)
2. At the top of the `Scorecard` component (after `currentRound` check), extract `_TOURNAMENT_META` from `gameData` and call `useTournamentOverlay(groupId, name, roundName, playerMapping, teamMatchup)`
3. After the last betting game section (after 6's Match Play / line ~1293), render a tournament card:
   - Gold-bordered card matching the existing game section styling
   - Trophy icon + tournament name + round name header
   - `TournamentMatchTracker` showing hole-by-hole dot tracker, team totals, match status
   - Only renders when `_TOURNAMENT_META` exists and overlay data is loaded

The section will look like the other game summaries — a rounded card with a themed header and the match tracker content inside.

### No other files changed
The hook and component already exist. No database changes needed.

1 file edited, 0 new files, 0 database changes.

