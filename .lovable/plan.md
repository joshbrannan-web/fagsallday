# Show awarded Team Points (2/2/2 F/B/O) on the tournament scoreboards

## Short answer

No. What you're looking at right now is raw hole points, not team points.

- Live Group Matches "7.5 - 10.5" = points won hole-by-hole inside the match.
- Team Round Result "7.5 / 10.5" and the Total row = the same raw hole points added up.

CGC 2026 is configured as custom points per round, mode Front/Back/Overall, 2 / 2 / 2. That award math exists in the app (`calcRoundTeamAward`), but the only scoreboard that uses it is the "Team Points" board — and this tournament's scoreboard list doesn't include one. So Round 1's 2/2/2 result is never displayed to players.

## What to build

1. Team Round Result becomes points-aware
   - Keep the raw hole points, but add the awarded points as the headline number.
   - Each round row shows: Front (2), Back (2), Overall (2) with the winner of each segment, the round's awarded total per team, and the raw hole points as a smaller secondary figure.
   - The Total row sums awarded points across completed rounds (so Round 1 would read 2 - 4 or whatever the segments produce, not 7.5 - 10.5).
   - Rounds still in progress keep showing live raw points with a note that award points are decided at round completion.

2. Fix pooled cross-group matches in the award path
   - The award/points helpers currently gather a round's hole results by group id only. CGC 2026 Round 1 stores every result against a cross-group match (`tournament_match_id`), with `tournament_group_id` null, so those helpers see zero points for the round.
   - Update the round-results lookup used by the award math to also accept results attached to the round's matches, the same way the two boards were just fixed.

3. Add the Team Points board to this tournament
   - Add "Team Points" (`team_points`) as a visible scoreboard so the Ryder-Cup style total and the per-round breakdown (with the F/B/O split) are available to players. Applied via the tournament's scoreboard settings, not hardcoded.

## Technical notes

- `src/components/scoreboards/TeamRoundResultScoreboard.tsx`: call `calcRoundTeamAward` per round, pass `teamScoringMethod` / `customRoundPoints` (already available in `ScoreboardData`, needs threading through `ScoreboardRenderer`), and render a Front/Back/Overall sub-row.
- `src/services/scoreboardCalculations.ts`: `calcTeamTotalsPerRound` and the FBO segment sums operate on the results array they're handed; the callers (`RyderCupGraphic`, `TeamPointsBreakdownTable`) must include `tournament_match_id`-linked results for the round.
- `src/components/scoreboards/TeamPointsBreakdownTable.tsx`: its per-group expansion needs a match fallback for pooled rounds (same pattern already used in Team Round Result).
- No schema changes; round config (`team_scoring_mode: 'fbo'`, points 2/2/2) is already stored correctly.
