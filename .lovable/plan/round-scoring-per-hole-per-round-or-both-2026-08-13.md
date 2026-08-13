# Round Scoring: Per Hole, Per Round, or Both

In the tournament wizard's Rounds step, the "Team Scoring for this Round" section becomes a toggle-button group instead of a dropdown, and gains an option to award points both per hole and per round (or just one of them).

## What the user sees

Four toggle buttons in each round card (shown when Team Scoring is "Custom Pts per Round"):

- **Per Hole only** — the round's hole-by-hole points are the only thing that counts toward the team total. No round-win bonus.
- **Per Round only** — hole points are ignored for the team total; only the round winner gets the configured points (current behavior, "No Points per Hole").
- **Per Hole + Per Round** — hole points count *and* the round winner also gets bonus points.
- **Front / Back / Overall** — unchanged; three segment values.

Selecting "Per Round only" or "Per Hole + Per Round" shows the points input for winning the round. Ties still split the value in half.

Defaults stay as today: Per Round only, 3 points; F/B/O 1 / 1 / 2.

## Technical notes

- Migration: extend the `tournament_rounds_team_scoring_mode_check` constraint to allow a new value `per_hole_and_round` alongside `per_hole`, `per_round`, `fbo`. No default change.
- `RoundConfigData.teamScoringMode` in `RoundConfigCard.tsx` gains `'per_hole_and_round'`; same for the type in `useTournaments.ts` and `RoundTeamScoringMode` in `scoreboardCalculations.ts`.
- `RoundConfigCard.tsx`: replace the Select with a 2x2 grid of toggle buttons (existing button styles, gold tournament accent for the active one), keeping the explanatory helper text per mode.
- `calcRoundTeamAward` in `scoreboardCalculations.ts`: for `per_hole_and_round`, start from the cumulative hole totals and add the round-win award on top (only once the round is completed); `per_hole` and `per_round` behave as they do now.
- `WizardStepReview.tsx`: add a one-line summary for the new mode.
- Existing rounds keep their stored mode; nothing is migrated or reinterpreted.
