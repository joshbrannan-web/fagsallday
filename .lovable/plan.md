# Clarify Round-Level Results Labeling in Test Mode

When teams are split across foursomes, the round is scored as one pooled team-vs-team match and the results are stored on the anchor group (the lowest group number). Today the Test Console and Test Scorecard label that block "Group 1", which reads as if only that foursome scored and the other group was skipped.

## What changes

1. **Test Console results panel**
   - When results are round-level (consolidated on the anchor group, no per-match rows), the block header reads **"Round match — all groups"** instead of "Group 1", with the two team names and their full rosters listed underneath.
   - Non-anchor group cards get a short note: "Scores feed the round match" so it's obvious zero points there is expected, not missing data.

2. **Test Scorecard page**
   - Same header treatment for the round-level section, and all eight players are shown grouped by team (not by foursome), so the best-ball selection on each hole is visible across groups.

3. **Best-ball transparency (small addition)**
   - On the round-level scorecard, dim the net scores that did not count toward the team's total on each hole, so the 6-6-6 "best 2 / best 3 / best 4" selection is visible at a glance.

No scoring logic changes — the calculations verified as correct.

## Technical notes

- Detect round-level mode the same way the data does: hole results exist with `tournament_group_id = anchorGroupId` and more than one test group in the round, with no `tournament_match_id`. Helper lives alongside the existing context builder in `src/services/roundLevelScoring.ts`.
- `src/pages/TournamentAdminTestConsole.tsx`: swap the `renderResultBlock` label for round-level mode; add the note to non-anchor group cards.
- `src/pages/TournamentAdminTestScorecard.tsx` / `src/components/tournament-admin/TestScorecardSection.tsx`: build a single round-level section from all test groups' players grouped by `team_id`; pass a per-hole "counted" set (best N net balls) to dim non-counting cells.
- Purely presentational: no schema changes, no writes, real scoreboards untouched.
