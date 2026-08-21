# Show the Front / Back / Overall award on the Results tab

## What I found (verified in the database)

Two separate things are wrong on the screen you're looking at (Tournament Admin → Results).

**1. The Results tab never applies the round award.**
`RoundResultsDashboard` builds both "Tournament Standings" and per-round "Team Results" from raw hole points only (`calcTeamTotals` / `calcTeamTotalsPerRound`). The function that converts hole points into the Front 2 / Back 2 / Overall 2 award (`calcRoundTeamAward`) is used by the Ryder Cup graphic, the Team Points breakdown table and the test views — but not here. So the 2/2/2 configured on Round 1 (confirmed: `team_scoring_mode = fbo`, points `{front:2, back:2, overall:2}`, tournament method `custom_pts_per_round`) can never appear on this tab.

**2. Round 1's stored hole results are per-foursome, not pooled.**
Round 1's game is `match_play_gross_best_ball`, which is a round-level (pooled) format. But the saved non-test results are 18 rows on Group 1 (SulRakVanJen wins every hole) and 18 rows on Group 2 (WilDonBraSah wins every hole) — each foursome scored as its own isolated match. That's why the totals read 18–18. The test round, which was scored with the round-level engine, produced 9.5–8.5 from the same kind of data. These real results predate the round-level scoring change and were never recalculated.

Left as-is, even after fixing #1 the award would compute off the wrong 18–18 inputs and show a meaningless 3–3.

## Plan

1. **Recalculate Round 1's real results with the round-level engine.**
   Add an admin action ("Recalculate results") on the round in the admin dashboard that runs the existing `recalcRoundLevelResults` for round-level game types (and the per-group/match path otherwise), replacing the stale per-group rows with one pooled result set on the anchor group. Run it for Round 1 so hole points reflect the pooled best-ball match.

2. **Show the round award on the Results tab.**
   In `RoundResultsDashboard`, for each round compute `calcRoundTeamAward` using the tournament's `team_scoring_method` / `custom_round_points` and the round's own `team_scoring_mode` / `team_scoring_points`.
   - Per-round "Team Results" cards show the **awarded** points as the headline number (e.g. 4 — 2) with the raw hole points as a smaller sub-line ("hole points 9.5 — 8.5").
   - Add a Front 9 / Back 9 / Overall breakdown line under the cards showing the hole-point comparison and who took each 2-point segment (halved 1–1 when tied).
   - "Tournament Standings" at the top sums the awarded points per round instead of raw hole points, so the standings match what the scoreboards show.
   - Rounds still in progress keep showing hole points and label segments "in progress".

## Technical notes

- `RoundResultsDashboard` currently receives `tournament`, `rounds`, `groups` — it already has everything needed except `team_scoring_method` / `custom_round_points`, which come off the `tournament` prop; verify they're selected in `TournamentAdminDashboard`'s fetch and add them if not.
- Reuse `calcRoundTeamAward` from `src/services/scoreboardCalculations.ts`; no new scoring math. The Front/Back/Overall display can reuse the presentation shape already in `TestRoundAwardCard`.
- Recalc uses `recalcRoundLevelResults` / `recalcRoundMatchResults` from `src/services/roundLevelScoring.ts` with `isTest: false`. It rewrites `tournament_hole_results` for the round only; player scores in `tournament_hole_scores` are untouched.
- No schema changes.
