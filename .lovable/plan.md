# Per-Round Team Scoring for Custom Points

When "Custom Pts per Round" is selected in the Team Scoring step, the Rounds step gains a per-round scoring section so each round can award points differently.

## What the user sees

In Step 1 (Basic Info), choosing **Custom Pts per Round** replaces the single "Points per Round Win" field with a note that points are configured per round in Step 4.

In Step 4 (Rounds), each round card gets a **Team Scoring for this Round** section with three modes:

- **Per Hole** — the round's team points come from the hole-by-hole results already configured in that round (Points Per Hole plus any per-hole overrides). No extra input.
- **Per Round** — one input: points awarded to the team that wins the round. Tie splits the value in half.
- **Front / Back / Overall** — three inputs (Front points, Back points, Overall points, e.g. 1 / 1 / 2). Front nine winner takes the front points, back nine winner takes the back points, and the team with the better full-round total takes the overall points. A tied segment splits that segment's points in half.

Defaults: mode "Per Round" with 3 points; F/B/O defaults 1 / 1 / 2.

## Where it applies

The tournament scoreboard team totals (Ryder Cup graphic and the round breakdown table) use each round's own mode instead of one global value. Rounds still only contribute once completed, matching today's behavior. When the tournament's method is Cumulative or Round Win (1pt), nothing changes.

## Technical notes

- Migration: add `team_scoring_mode text` (`per_hole` | `per_round` | `fbo`, default `per_round`) and `team_scoring_points jsonb` (e.g. `{"round":3}` or `{"front":1,"back":1,"overall":2}`) to `public.tournament_rounds`. Existing rows keep current behavior by backfilling from the tournament's `custom_round_points`.
- `RoundConfigData` in `RoundConfigCard.tsx` gains `teamScoringMode` and `teamScoringPoints`; the new UI section renders only when the wizard's `teamScoringMethod === 'custom_pts_per_round'`, so `WizardStepRounds` and `CreateTournamentWizard` pass that flag down.
- `useTournaments.createTournament` persists the two new columns per round; `WizardStepReview` shows a one-line summary per round.
- `useTournamentScoreboards` selects the new columns on rounds. Scoring logic moves into a helper in `src/services/scoreboardCalculations.ts`: `calcRoundTeamAward(round, roundTotals, holeResultsForRound, method, customRoundPoints)` returning per-team points for that round. `RyderCupGraphic.tsx` and `TeamPointsBreakdownTable.tsx` call it instead of their inline round-win math.
- F/B/O uses `tournament_hole_results` for the round's groups: sum `team_points` for holes 1-9, 10-18, and all holes, then award each segment's configured points (half each on a tie).
- Per-hole mode is exactly the existing cumulative sum of the round's hole points.
- Editing an existing tournament's rounds is out of scope for this change; values are set at creation.
