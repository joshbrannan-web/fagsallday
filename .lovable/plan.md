# Fill All Scores + Results Check for Test Rounds

Give the Test Console a one-click way to populate an entire test round with realistic random scores, then immediately review how the round scored.

## What you get

1. **Fill All Scores button** on the Test Console (in the gold test area, next to Reset Test)
   - Confirmation dialog: "Randomly fill every hole for every test group?" — warns it overwrites existing test scores.
   - Fills all holes (1-18 or 1-9 per the round's course) for every player in every test group with random gross scores weighted around par (roughly: eagle rare, birdie/par/bogey common, double occasional).
   - Runs the exact same scoring path a real round uses: cross-group match recalculation if the round has matches, round-level pooled scoring for formats like Gross Best Ball, otherwise the per-group engine.
   - Also writes the scores into each test group's practice round record so the group scorecards show the same numbers.
   - Options: fill all groups, or fill a single group from that group's row.

2. **Results panel on the Test Console** (appears once any scores exist)
   - Per group / per match: hole-by-hole result dots, running status (e.g. "2 UP thru 12"), and final outcome.
   - Team and player totals for the test round (gross, net, points as applicable to the round's game).
   - "Recheck results" refresh button, plus existing links into each group's full scorecard.

3. **Reset Test** already clears everything, so you can fill, inspect, reset, and run again.

## Technical notes

- New `fillTestRoundScores(tournamentRoundId, opts?)` in `src/services/testRounds.ts`:
  - Loads test groups (`is_test = true`), their players, and the round's `course_data` for pars/hole count.
  - Generates scores per player/hole, upserts to `tournament_hole_scores` on `(tournament_group_id, tournament_player_id, hole_number)`.
  - Updates each test group's `rounds.scores` blob to match.
  - Calls `recalcRoundMatchResults` / `recalcRoundLevelResults` with `{ isTest: true }`, or `calcTournamentHoleResults` + upsert to `tournament_hole_results` for per-group formats — mirroring `useTournamentOverlay.batchSyncAllScores`.
- `src/pages/TournamentAdminTestConsole.tsx`: add the fill action (all + per group), a results section rendering test `tournament_hole_results` and `tournament_round_matches` (test) via the existing `HoleResultDots` / `MatchStatusBar` components and `scoreboardCalculations`, and refresh after fill.
- No schema changes; all reads/writes stay inside `is_test` rows so real scoreboards are untouched.
