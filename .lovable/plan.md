# Round Results Per Hole (Live Rounds)

Give the Rounds tab the same hole-by-hole verification view the Test Console already has, but for real rounds.

## What you get

1. **"View Scorecard & Results" button** on every round card in the tournament's Rounds tab (next to the edit/delete controls).

2. **New Round Scorecard & Results page** that opens from that button:
   - **Round Points Award card** at the top: Front 9 / Back 9 / Overall winners and the points awarded (2/2/2 or whatever the round is configured for), plus the final award line.
   - **One scorecard section per group** (or per cross-group match, or a single pooled "Round match — all groups" section when the round uses round-level best-ball) — matching however the round actually scores.
   - Each section shows: hole numbers + par, every player's gross (and net when handicaps are on) with non-counting best-ball scores dimmed, OUT/IN/TOT totals, a per-hole result row with the winning team's color dot / "½" for halves, the hole result label, running team point totals, and the match status line ("2 UP thru 12", "Match Complete").
   - **Recalculate button** to re-run the scoring engine on the round if results look stale, then reload the view.
   - Link into each group's editable scorecard for fixing a wrong score.

## Technical notes

- New page `src/pages/TournamentAdminRoundScorecard.tsx`, route `/tournament-admin/:tournamentId/round/:roundId/scorecard` registered in `src/App.tsx`.
- The page is a non-test twin of `src/pages/TournamentAdminTestScorecard.tsx`: same layout and it reuses `TestScorecardSection.tsx` and `TestRoundAwardCard.tsx` unchanged (they are already presentational and take data as props).
- Data loading: `tournament_groups` (`is_test = false`) + `tournament_group_players`, `fetchRoundMatches(roundId)` (no `isTest`), `tournament_hole_scores` / `tournament_hole_results` filtered to those group and match ids, plus `tournament_rounds.course_data`, `tournament_games`, `tournament_teams`, `tournament_players`, and the tournament's `team_scoring_method` / `custom_round_points`.
- To avoid duplicating the test-only loader, add a non-test group-summary helper alongside `fetchTestGroupSummaries` in `src/services/testRounds.ts` (same shape, `is_test = false`), or parameterize the existing one.
- Recalculate uses the existing non-test paths already wired in `RoundResultsDashboard.tsx` (`recalcRoundMatchResults` / `recalcRoundLevelResults`), so no new scoring logic.
- Read-only for scores; editing continues on the existing group scorecard page. No schema changes.
