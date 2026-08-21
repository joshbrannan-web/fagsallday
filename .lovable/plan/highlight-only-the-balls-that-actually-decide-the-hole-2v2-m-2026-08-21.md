# Highlight only the balls that actually decide the hole (2v2 match play)

On the 2v2 match-play scorecard, both teammates' scores are currently outlined/tinted on every hole. In best-ball match play only one ball per side decides the hole — the second ball matters only when the two sides' best nets tie and the 2nd-ball tiebreaker is used.

## What changes on screen

For each hole, per team:

- Highlight only the single lowest-net score on that side (hole 2: Erik Jensen 2/net 1 in blue, Scott Willett 2 in red).
- If the two teams' best nets tie and the 2nd-ball tiebreaker decides the hole, also highlight each side's 2nd-best net — those scores genuinely determined the winner.
- If the hole is halved after the tiebreaker, highlight the balls that were compared (best, plus 2nd if it was consulted), with no winner tint.
- All other teammate scores stay dimmed.
- Aggregate formats (Gross 6/6/6 and any format where more than one ball is summed) keep today's behavior: every counting ball highlighted.
- The `Team net` footer rows keep showing the value actually compared for the hole (best net, or best + 2nd only where the tiebreaker applied), so the rows stay consistent with the highlighting.

## Technical notes

- Contained in `src/components/tournament-admin/TestScorecardSection.tsx`, shared by the live round scorecard (`TournamentAdminRoundScorecard`) and the test scorecard (`TournamentAdminTestScorecard`). No engine, data, or scoring changes.
- `countingIds` currently takes `ballsCounted(hole)` balls per team independently. Change it to a hole-level computation that looks at both teams together: take each side's best net; if best nets differ, each side contributes one id; if they are equal and the 2nd-ball tiebreaker is enabled for the round, add each side's 2nd-best net id.
- Keep the existing per-team `ballsCounted > 1` path unchanged for aggregate/sum formats — the new one-ball-plus-tiebreak logic applies when the format compares a single best ball.
- `countingSetFor`, the winner tint, and the team-net footer all read from the same helper, so they stay in sync automatically.
