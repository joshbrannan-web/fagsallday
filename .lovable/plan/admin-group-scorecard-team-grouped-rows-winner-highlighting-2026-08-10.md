# Admin Group Scorecard: team-grouped rows + winner highlighting

## What changes

**1. Group teammates together**

Player rows on the admin scorecard (both the nine-hole blocks and the totals table) get sorted so all players on the same team sit next to each other, instead of the current raw group-player order. For the group on screen that means John Boss, Kimball Payne (Putt Pirates), then Josh Brannan, Mau.

Sort order: by team (teams in the order they appear in the tournament's team list), then by existing order within a team. Players with no team fall to the bottom.

**2. Highlight the hole winner in the team color**

For each hole, the stored hole result already records points per team. The scorecard reads that and boxes the score cells of every player on the winning team in that team's color (tinted background plus a colored border), so hole 1 shows John's and Kimball's 5 and 4 in a red box.

- Halved holes (tie at the top): no highlight, so a win always reads clearly.
- Holes not yet played, or with no result row: no highlight.
- Individual/1v1 games where results are stored per player rather than per team: highlight only the winning player's cell, still in their team color.
- Pending (unsaved) edits keep their existing purple pending styling — the winner box is applied only to saved scores, since the result hasn't been recalculated yet.

## Technical notes

- All changes are contained in `src/components/tournament-admin/GroupScorecardAdmin.tsx`; no props contract change and no scoring/engine/save-path changes.
- Add an `orderedPlayers` memo that sorts `groupPlayers` by the index of `team_id` in the `teams` array; use it everywhere `groupPlayers.map` is used today (nine grids and totals table) and for the `playerIds` keyboard-navigation array so Tab order follows the visible order.
- Add a `holeWinners(hole)` helper deriving winning team id (max value in `team_points`, null when tied or empty) and, as a fallback, winning player ids from `player_points`.
- Apply the highlight inline via `style` using the team's hex color for border plus a low-opacity background (color-mix / rgba), since team colors are per-tournament data, not design tokens.
