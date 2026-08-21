# Show which scores decide each hole

Make the round scorecard self-explanatory: for every hole, show exactly which player scores were used, what net value each contributed, and how those add up to the team total that won the hole.

## What changes on screen

On both the live round view (Round Points Award page) and the Test Round scorecard:

1. **Counting scores are marked, not just dimmed.** For best-ball style formats, each score cell that counts toward its team's hole result gets a solid ring in the team color. Scores that did not count stay dimmed. In formats where every ball counts, all cells are ringed.
2. **Net value shown under the gross.** When handicaps apply, each cell shows the gross score with the small net value beneath it (e.g. `5` with `4` under it) so it's clear which number the engine compared. Gold stroke dots stay as they are.
3. **Winning cells emphasized.** On a hole that was won outright, the winning team's counting cells get a filled tint in the team color; a halved hole tints both sides lightly.
4. **Two new footer rows per hole:**
   - `Team A net` and `Team B net` — the summed net of the counting balls for that hole (the exact number compared to decide the hole), colored by team.
   - The existing `Result` dot row stays directly below, so the comparison reads top to bottom: scores used, team totals, winner.
5. **Legend** added under the existing stroke-dot note: ringed = counted toward team score, dimmed = not counted, tinted = hole winner.

## Technical notes

- All work stays in `src/components/tournament-admin/TestScorecardSection.tsx`, which is already shared by `src/pages/TournamentAdminRoundScorecard.tsx` and `src/pages/TournamentAdminTestScorecard.tsx`. No engine or data changes; both pages already pass `handicaps`, `holeStrokeIndex`, `bestBall`, and `ballsCounted`.
- Net is derived in the component as `gross - strokesFor(playerId, hole)` using the existing `strokesReceived` relative-to-low-handicap logic already in the file.
- The existing `countingIds(teamId, hole)` helper already selects the N best balls; reuse it for both the ring styling and the new team-net rows rather than duplicating selection logic. When `bestBall` is false, treat all players with a score as counting.
- The team-net rows render only when a match exists (`teamAId` and `teamBId` present), matching the current `Result` row condition.
- Colors come from the team color values already passed in `teams`; tints use `color-mix` on those values, consistent with `GroupScorecardAdmin`.

## Caveat

The net row reflects the component's own stroke math, which mirrors the engine's relative-to-low-handicap rule for the players shown. In pooled round-level matches spanning multiple groups, the low handicap is computed across all players in the pooled view, matching how the pooled results are calculated.
