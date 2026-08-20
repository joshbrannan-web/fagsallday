# Show Front / Back / Overall points in the test round

## What's actually happening

Round 1 is already set to **Front/Back/Overall — 2 / 2 / 2** (confirmed in the database: the round's team scoring mode is `fbo` with front 2, back 2, overall 2, and the tournament uses Custom Pts per Round).

Two different numbers are in play, and the test views only show the first one:

1. **Hole points** — the round's game (Gross Best Ball 6/6/6) awards 1 point per hole, half each when tied. Over 18 holes that's the **9.5 – 8.5** you see. These are the raw inputs.
2. **Round award** — those hole totals are then converted into Front (2), Back (2), Overall (2) for the tournament standings. That conversion lives in `calcRoundTeamAward` and today runs only in the tournament scoreboards (Ryder Cup graphic, Team Points breakdown), and only once the round's status is `completed`.

So nothing is broken — the test console and test scorecard just never apply step 2, and a test round is never marked completed, so even the scoreboards wouldn't show it.

For this test data the award would be: Front (holes 1–9) and Back (holes 10–18) compared on hole points, plus Overall on the 9.5 – 8.5 total → Sul takes Overall's 2 points; Front and Back go to whoever leads that nine, halved 1–1 if tied. Six points total instead of 18.

## What to change

Add a **Round Points Award** panel to the test views so the admin can verify the real tournament payout, not just the raw hole points:

- **Test Scorecard page** — under the pooled round match, a new card showing:
  - Front 9: hole points A–B → who takes the 2 pts (or 1–1 halved)
  - Back 9: same
  - Overall: same, using the full-round hole totals
  - Round award line: `Team SulRakVanJen 4 — Team WilDonBraSah 2`
  - A one-line explainer: "Hole points decide each segment; the round contributes these 6 points to the tournament standings."
- **Test Console** — the existing results block gains the same round-award summary line beneath the raw team totals.
- Segments still in progress are labeled "in progress" rather than awarded, so a partly filled test round doesn't imply a false result.
- Raw hole totals stay visible — they're what the segments are decided on.

## Technical notes

- Reuse `calcRoundTeamAward` from `src/services/scoreboardCalculations.ts` with `isCompleted: true` (the test round is a sandbox, so treat it as final for preview purposes) and the round's own `team_scoring_mode` / `team_scoring_points`.
- `src/pages/TournamentAdminTestScorecard.tsx`: already loads the round row and the test hole results; add the tournament's `team_scoring_method` and `custom_round_points` to the existing fetch, then render a new `TestRoundAwardCard`.
- New `src/components/tournament-admin/TestRoundAwardCard.tsx`: pure presentation, takes hole results, team ids/names, mode and points.
- `src/pages/TournamentAdminTestConsole.tsx`: render the same card in the results block.
- No database or scoring-engine changes — the award math already exists and is used by the live scoreboards.
