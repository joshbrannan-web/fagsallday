# Speed up the Live Group Matches scoreboard

## What's slow today

Loading the scoreboards page runs one long chain before anything renders:

1. Fetch scoreboards, rounds, teams, players, tournament settings
2. Then fetch games + groups
3. Then fetch cross-group matches
4. Then fetch group players + hole points
5. Then fetch hole scores + hole results
6. Then **recalculate scoring for every round that has any scores** — including re-fetching each round's full context and writing results back to the database
7. Only then does the spinner go away

Step 6 is the biggest cost. For rounds with cross-group matches, the recalculation runs on **every page load**, even when results are already saved and up to date. On a tournament with several rounds this is many extra round trips plus database writes before the user sees anything.

## The fix

**1. Stop blocking the screen on recalculation**

Show the scoreboard as soon as the scores and results are loaded (end of step 5). Any recalculation runs in the background afterward, and the board updates in place when it finishes. Perceived load time drops to the data fetch alone.

**2. Only recalculate when results are actually stale**

Apply the same freshness check the round-level path already uses to the cross-group match path: compare the number of fully scored holes against the number of saved result rows for that round's matches. If they match, skip the recalculation entirely. On a settled round, this removes all of step 6.

**3. Flatten the fetch waterfall**

Rounds, games, groups, group players and hole points are currently fetched in four sequential waves. Collapse them into two waves by querying games, groups, group players, hole points, scores and results by `tournament_id` where possible instead of chaining on ids from the previous query. This cuts several network round trips.

**4. Keep the board warm between visits**

Cache the last successfully loaded scoreboard payload in local storage per tournament. On revisit, render the cached board immediately and refresh in the background, matching the offline-first behavior used elsewhere in the app.

## Technical notes

- `src/hooks/useTournamentScoreboards.ts`: move `backfillMissingResults` out of the `isLoading` critical path (`setIsLoading(false)` right after `fetchScoresAndResults`, then `void backfillMissingResults(...)`).
- In the cross-group match branch of `backfillMissingResults`, add a completeness guard before calling `recalcRoundMatchResults(rid)` — count distinct fully scored holes for the round vs. distinct `hole_number` rows already present for that round's `tournament_match_id`s, and `continue` when equal.
- Replace the `.in('tournament_round_id', roundIds)` chains with tournament-scoped queries issued in the first `Promise.all` where the schema allows; keep the existing shaping logic.
- Add a `fg_tournament_scoreboards_<tournamentId>` local storage snapshot with a timestamp, hydrated on mount and overwritten after each successful `fetchAll`, following the existing offline-storage freshness-gate pattern.
- No schema or scoring-logic changes; results and points stay identical.
