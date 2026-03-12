

# Fix: Slow Tournament Round Info Loading on Scorecard

## Problem
When viewing the Scorecard during a tournament, the "Tournament Round" section takes noticeably long to appear. The `useTournamentOverlay` hook makes **4 sequential network round-trips** before it can render:

1. Fetch `tournament_groups` → get `tournament_round_id`
2. Fetch `tournament_rounds` → get `tournament_id`, `course_data`
3. Fetch 5 tables in parallel (teams, game, group_players, players, scores)
4. Fetch `tournament_hole_points` → **sequential, waits for step 3 to finish**

Step 4 is the unnecessary bottleneck — it depends only on `tournament_round_id` (available after step 2), not on the game result from step 3.

## Fix
**File:** `src/hooks/useTournamentOverlay.ts`

Move the `tournament_hole_points` fetch into the parallel batch in step 3. Since we don't know the `tournament_game_id` yet, we fetch hole points by joining through `tournament_games` for the round — or more simply, we fetch the game first and include hole points in the same parallel batch by restructuring slightly:

**Approach:** Add `tournament_hole_points` to the existing `Promise.all` on line 200. We can fetch all hole points for games in this round by first getting the game, then fetching points — but since the game query is already in the parallel batch, the simplest fix is:

1. Move `tournament_hole_points` into the `Promise.all` by querying via a broader filter (all games for the round), then filtering client-side
2. Remove the sequential `await` on line 233-236

```text
Before (4 round trips):
  groups ──► rounds ──► [teams, game, players, groupPlayers, scores] ──► hole_points

After (3 round trips):
  groups ──► rounds ──► [teams, game, players, groupPlayers, scores, hole_points]
```

This eliminates one full network round-trip. The `tournament_hole_points` query joins through `tournament_games` to filter by `tournament_round_id`, which is available after step 2.

### Changes
- Lines 200-206: Add a 6th query to the `Promise.all` fetching `tournament_hole_points` joined via `tournament_game_id` from games in this round
- Lines 233-244: Remove the sequential fetch and use the pre-fetched data instead

One file, ~15 lines changed.

