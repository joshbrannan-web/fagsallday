# Test Round Scorecard & Results View

Give the Test Console a way to click into the round and see a real scorecard with per-hole winners and losers, so scoring can be verified at a glance.

## What you get

1. **"View Scorecard & Results" button** on the Test Console — one at the top for the whole test round, plus one on each group row.

2. **New Test Scorecard page** (read-focused, opens from those buttons):
   - **Course header row**: hole numbers 1-18 (or 1-9), par, and OUT / IN / TOT columns.
   - **Player rows** grouped by team, with team color dot, gross score per hole (net in parentheses when the round uses handicaps), and OUT / IN / TOT totals. In best-ball formats the non-counting score on each hole is dimmed so you can see which ball counted.
   - **Result row per hole**: colored dot for the winning team, "½" for a halve, "—" for holes not yet played, with the hole's result label (e.g. "Team A wins hole", "Halved") shown on hover/tap and listed under the card.
   - **Running status line**: e.g. "Red leads 2 UP thru 12 • 4 pts left", plus a final "Match Complete" banner with the winner and final points when the match is decided.
   - **Team point totals** for every hole block.

3. **Section per match, or per group**, matching how the round actually scores:
   - Rounds with cross-group matches get one scorecard section per match, pooling the two sides' players even when they sit in different foursomes.
   - Rounds without matches get one section per test group.

4. **Quick actions kept in reach**: each section links to "Enter scores" for that group, and the gold test banner (Reset Test / back to console) stays on the page.

## Technical notes

- New route `/tournament-admin/:tournamentId/test/:roundId/scorecard` -> new page `src/pages/TournamentAdminTestScorecard.tsx`, registered in `src/App.tsx`.
- Data loading reuses existing test-aware helpers: `fetchTestGroupSummaries` and `fetchRoundMatches(roundId, { isTest: true })` from `src/services/testRounds.ts` / `roundLevelScoring.ts`, plus direct reads of `tournament_hole_scores`, `tournament_hole_results` (filtered to the test groups / test match ids), `tournament_games`, `tournament_teams`, `tournament_players`, and `tournament_rounds.course_data` for pars.
- A new presentational component `src/components/tournament-admin/TestScorecardSection.tsx` renders one match/group scorecard table + result row + status line, following the table markup already used in `src/pages/TournamentGroupScorecard.tsx` and `TournamentFullScorecard.tsx` (semantic tokens, team colors from `tournament_teams.color`).
- Match/dormie/complete status uses the same points-remaining logic already in `TournamentGroupScorecard.tsx`, extracted into the new component so both stay consistent.
- Test Console (`src/pages/TournamentAdminTestConsole.tsx`) gains the navigation buttons; its existing inline results summary stays.
- Read-only view — no schema changes, no writes; score editing continues to happen on the existing group scorecard page.
