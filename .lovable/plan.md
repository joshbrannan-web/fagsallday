# Scorecard & Results button on Team Round Results

Give tournament viewers the same hole-by-hole "Scorecard & Results" view that admins get from the Rounds tab — reachable straight from each round row on the Team Round Results board.

## What changes

- Each round row in Team Round Results gets a "View Scorecard & Results" button (visible for started rounds).
- Tapping it opens a read-only results page for that round: hole-by-hole scorecard per group/match, hole winners, handicap stroke markers, deciding-ball highlighting, match standings, and the round points award (Front/Back/Overall or per-match).
- Read-only for everyone: no recalculate button, no score editing, no auto-heal writes. If results have not been calculated yet, the page shows the existing "Results not calculated yet" message.
- Back button returns to the tournament scoreboards page.

## Technical notes

- New page `src/pages/TournamentViewRoundScorecard.tsx` at route `/tournament/:joinCode/round/:roundId/results` (registered in `src/App.tsx`).
- It reuses the existing read-only presentation components: `TestScorecardSection` and `TestRoundAwardCard`, and the same loaders as `TournamentAdminRoundScorecard` (`fetchTestGroupSummaries`, `fetchRoundMatches` with `isTest: false`, `calcRoundTeamAward`) — resolving `tournamentId` from the `joinCode` lookup instead of the admin hook.
- Admin-only behaviours from `TournamentAdminRoundScorecard` are omitted: the `useTournamentAdmin` guard, `recalcRoundLevelResults` / `recalcRoundMatchResults` calls, and the Recalculate control.
- `TeamRoundResultScoreboard.tsx` gains the button in the round row (using `useNavigate` and the `joinCode` prop it already receives), with `stopPropagation` so it does not toggle the expand/collapse row.
- No database, RLS, or scoring-logic changes; the page reads the same tables the scoreboards already read.
