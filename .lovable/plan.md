

# Enhanced Live Group Matches — Match Status + Expandable Hole Details

## What Changes

Transform each group match row in `GroupMatchesScoreboard` from a compact one-line score into a richer card that shows:

1. **Match status line** — e.g., "Team A leads · Thru 5 · 13 pts left" (same style as `TournamentMatchStatusBar`)
2. **Expandable hole-by-hole detail** — clicking the match toggles an inline hole tracker (reusing the same layout as `TournamentHoleTracker`)

Instead of navigating away to a separate page on click, tapping a match expands/collapses the detail inline. A small "View Scorecard →" link at the bottom of the expanded section still allows navigation to the full group scorecard page.

## File Changes

### `src/components/scoreboards/GroupMatchesScoreboard.tsx` — Major rewrite

- Add `expandedGroupId` state to track which group is expanded (one at a time)
- For each group match, replace the current single-row layout with:
  - **Header row**: Team names + score + team color dots (similar to current but tappable to expand)
  - **Status line**: Compute lead text ("Team A leads · Thru N · X pts left" / "All Square" / "Final") from `calcTeamTotals` and holes played count
  - **Expanded section** (when tapped): Show hole-by-hole grid matching `TournamentHoleTracker` layout — columns: Hole, Team A score, Team B score, Result
- Derive per-hole data by filtering `holeResults` for the group, building a `Record<number, { teamPoints, resultLabel }>` keyed by hole_number
- Get course holes from the round's `course_data` (already available in `rounds` array)
- Compute `holesPlayed` = count of hole results for the group
- Compute `totalPointsAvailable` from course holes count × default points (from `games` prop)
- Add "View Full Scorecard →" link at bottom of expanded section that navigates to `/tournament/${joinCode}/round/${roundId}/group/${groupId}`

### No other files changed

All data (`holeResults`, `holeScores`, `games`, `rounds` with `course_data`) is already passed into this component via `ScoreboardRenderer`. No new queries or hooks needed.

**1 file changed, 0 database changes.**

