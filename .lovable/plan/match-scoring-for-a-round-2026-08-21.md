# Match Scoring for a Round

Today each round rolls up to team points from pooled hole points (Per Hole, Per Round, Per Hole + Per Round, Front/Back/Overall). This adds a fifth option — **Per Match** — where every individual match in the round is scored on its own and the round award is the sum of those match results.

## How Per Match works

For each match in the round (a cross-group 2v2 match, or a foursome group when no cross-group matches exist):

- The winner of each hole is decided by **match play holes up/down** — the side with the better hole result wins the hole, halves count as neither. Point values per hole are ignored.
- Each match awards up to four configurable values:
  - Front 9 (holes won 1-9)
  - Back 9 (holes won 10-18)
  - Overall (holes won across 18)
  - Match win bonus (optional, for taking the match overall)
- Any tied segment splits its points evenly between the two sides.
- Points from every match are summed into that side's team total for the round, then flow into the tournament grand total exactly as other modes do.

Example: 2 matches, Front 1 / Back 1 / Overall 2 per match. Team A wins both fronts, splits one back, loses one overall → A = 1+1+0.5+2 = 4.5, B = 0.5+2 = 2.5.

## Where the user chooses it

In the round scoring settings ("Team Scoring for this Round") — both the create-tournament wizard and the tournament admin dashboard round editor — a new **Per Match** button next to the existing four. Selecting it reveals inputs for Front / Back / Overall / Match win points. The wizard review step and the round summary line on the admin dashboard describe the chosen mode.

## Where results show up

- Round Results dashboard: per-match breakdown (holes up/down, segment winners, points awarded) instead of the pooled F/B/O table.
- Team Round Result scoreboard and Team Points breakdown: awarded match points as the headline figure, raw hole points as secondary.
- Test round award card and test scorecard: same per-match breakdown, so a test round verifies the math before going live.
- Grand totals (Ryder Cup graphic, standings) pick up the awarded points with no extra changes.

## Technical notes

- DB: no schema change needed. `tournament_rounds.team_scoring_mode` gets the new value `'per_match'`; `team_scoring_points` gains optional `match` (win bonus) alongside existing `front`/`back`/`overall`. A migration is only needed if a check constraint restricts `team_scoring_mode` — verify first and add one only if required.
- `src/services/scoreboardCalculations.ts`: extend `RoundTeamScoringMode` and `RoundTeamScoringPoints`; add `calcRoundMatchAward(matchUnits, holeResults, teamIds, pts)` that derives per-hole winners from `team_points` per match unit, computes holes up/down per segment, and awards points. `calcRoundTeamAward` delegates to it when mode is `per_match`.
- Match units are resolved from `tournament_round_matches` (cross-group, `side_a`/`side_b` + `team_a_id`/`team_b_id`) and fall back to `tournament_groups` + `team_matchup` for standard foursomes; hole results are matched by `tournament_match_id` or `tournament_group_id`.
- UI touch points: `RoundConfigCard.tsx`, `WizardStepReview.tsx`, `TournamentAdminDashboard.tsx` (mode label + save mapping), `RoundResultsDashboard.tsx`, `TeamRoundResultScoreboard.tsx`, `TeamPointsBreakdownTable.tsx`, `TestRoundAwardCard.tsx`, `useTournaments.ts` type.
- Unit tests added to `tournamentEngine.test.ts` style coverage for the new award function (clean win, halved segment, multi-match sum).
