# Round-level scoring for Gross Best Ball (6/6/6)

## The problem

Gross Best Ball is scored **per foursome** today. For each hole the engine takes each team's best 2 scores (holes 1-6), best 3 (holes 7-12) and best 4 (holes 13-18) from the players *in that group only*.

In a foursome with 3 players from Team A and 1 from Team B:
- Team B has only one score available, so from hole 7 on it can never produce the 3 or 4 balls the format requires.
- The result is that Team B loses nearly every hole in that group, and the hole is scored on an unequal number of balls.

CGC 2026 Round 1 is set to Gross Best Ball and no groups/pairings exist yet, so this can be fixed before pairings are built.

## What will change

For Gross Best Ball rounds, the match becomes a single **4 v 4 team match for the whole round**, independent of which foursome each player teed off in:

- For every hole, pool all four Team A players and all four Team B players across every group in that round.
- Take the required number of best balls (2 / 3 / 6-6-6 pattern) from each team's full four-player pool.
- Award the hole's points to the winning team once for the round (not once per group).
- Uneven foursomes (3 v 1, 4 v 0, mixed) no longer distort anything — a player's score counts for their team regardless of who they played with.
- A hole is only scored once every player on both teams has a score for it, so results appear as groups finish that hole.

## What stays the same

- Score entry is unchanged: scorekeepers still enter scores per foursome.
- Other formats (Best Ball Match Play 2v2, individual match play, scramble, sixes) keep their current per-group scoring.
- Team totals, standings and the round scoreboard read from the same results, so the tournament scoreboards keep working.

## Display

- The Round 1 scoreboard shows one team match ("Team A vs Team B") with the hole-by-hole points and match state, instead of one match per foursome.
- Each hole shows both teams' counted balls and the running total.
- Group scorecards continue to show each foursome's raw scores.

## Technical notes

- `src/services/tournamentEngine.ts`: keep `calcGrossBestBall` pure, but drive it from a round-wide `players` / `teamAssignments` / `scores` input rather than a group slice; guard the "not enough balls" case explicitly instead of silently slicing a short array.
- `src/hooks/useTournamentScoreboards.ts` (`backfillMissingResults`): for `match_play_gross_best_ball` / `blind_gross_best_ball`, build a single engine input per round — union of all groups' players, team assignments from `tournament_group_players`, and all `tournament_hole_scores` for that round's groups.
- `tournament_hole_results` is keyed by `(tournament_group_id, hole_number)`. Round-level results will be written against a single anchor group for the round (lowest `group_number`), with the other groups' rows for that round cleared, so the existing unique constraint, realtime channels and scoreboard readers stay intact. Alternative if this proves fragile: add a nullable `tournament_round_id` column plus a `(round, hole)` unique index for round-level games.
- Team assignment resolution must fall back to `tournament_players.team_id` when a group row lacks `team_id`, so a lone player in a 3v1 group is still attributed correctly.
- Same treatment applied to the read paths in `useTournamentScorecard.ts` and `useTournamentOverlay.ts` so live views match the scoreboard.
- Add engine tests for a 3v1 and a 4v0 group split producing the same round result as a balanced 2v2 / 4v4 arrangement.
