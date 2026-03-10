

# Fix: 1v1 Engine for 4-Player Groups with Sub-Matchups

## Problem
When a group has 4 players in a 1v1 game type (e.g. `match_play_individual`), the engine function `calcMatchPlayIndividual` does `const [p1, p2] = players` — it only processes the first 2 players. The other 2 players' scores are completely ignored. They never get calculated, never get persisted to `tournament_hole_results`, and never show on scoreboards.

## Root Cause
The engine has no concept of sub-matchups. It always assumes exactly 2 players for individual match play. The `EngineInput` interface doesn't carry sub-matchup data from the group's `team_matchup` JSONB.

## Solution
When a group has 4 players and sub-matchups are defined, run two separate 1v1 calculations and merge the results per hole.

### Files Changed

**1. `src/services/tournamentEngine.ts`**
- Add `subMatchups` to the `EngineInput` interface: `subMatchups?: { playerA: string; playerB: string }[]`
- Update `calcMatchPlayIndividual`: when `players.length > 2` and `subMatchups` exists, split into two separate 1v1 engine runs (one per sub-matchup), then merge the `HoleResult` arrays — combining `teamPoints`, `playerPoints`, `grossScores`, `netScores` per hole, and concatenating result labels (e.g. "Player A wins · Player C wins")
- When `players.length > 2` but no `subMatchups`, fall back to pairing by team (first player of team A vs first player of team B, etc.)

**2. `src/hooks/useTournamentOverlay.ts`**
- On initial load, read `subMatchups` from `group.team_matchup` JSONB
- Store it in state and a ref (like the other engine inputs)
- Pass `subMatchups` into the `EngineInput` when calling `calcTournamentHoleResults`
- Do this in both the initial load engine call and the `reload` function

**3. `src/hooks/useTournamentScorecard.ts`**
- Also pass `subMatchups` from the group's `team_matchup` into the engine input (this hook also calls `calcTournamentHoleResults`)

### Merge Logic for 2 Sub-Matches
For each hole, if both sub-matches have results:
- `teamPoints`: sum across both matches
- `playerPoints`: union of both matches' player points
- `grossScores` / `netScores`: union of all 4 players' scores
- `resultLabel`: join both labels with " · "
- `pointsValue`: sum of both matches' point values

Match state uses the merged team totals for the overall lead/status display.

