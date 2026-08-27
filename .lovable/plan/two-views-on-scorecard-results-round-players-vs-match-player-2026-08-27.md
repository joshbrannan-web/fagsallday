# Two views on Scorecard & Results: Round Players vs Match Players

Today the Scorecard & Results page shows a single scorecard per match. When a round is scored as one team-vs-team match, that means all 8 players land in one "Match 1" block, so you can't see who actually played together in each foursome.

## What changes

- A toggle at the top of the Scorecard & Results page with two options:
  - **View Round Players** — one scorecard per group/foursome (Group 1, Group 2, ...), showing exactly the players who walked the course together.
  - **View Match Players** — one scorecard per match (the current behavior), showing the two sides of each team match.
- The toggle only appears when both views are meaningful (the round has groups and at least one match, or a pooled round-level match). If a round has no matches, only the group view renders and no toggle shows.
- Default view: **Match Players** when the round has matches, otherwise **Round Players**.
- The Round Points Award card at the top stays the same in both views — it reflects the round's official award and doesn't change with the view.
- In Round Players mode, hole-winner tinting and match status only appear for groups that have their own per-hole results. For pooled/cross-group rounds where the result rows belong to the match rather than a single foursome, each group card shows its scores, net values and stroke dots plus a short note that the hole results for these players are decided at the match level (with the toggle available to jump there).
- Same toggle on both the admin page and the read-only viewer page, so admins and players see the same options.
- When the page is opened focused on a single match or group (from the Rounds & Matchups buttons), the toggle is hidden and the focused card renders as it does today.

## Technical notes

- `src/pages/TournamentAdminRoundScorecard.tsx` and `src/pages/TournamentViewRoundScorecard.tsx`: add a local `viewMode: 'round' | 'match'` state, rendered with the existing shadcn `Tabs`/toggle styling above the scorecard list. Both files already compute `groups`, `matches`, `results`, `scores`, `teams`, `players`, `strokeProps`, `pointsPerHole`, `bestBall`, `ballsCounted` — the branch just selects which list to map over.
- Round Players mode reuses the existing per-group `TestScorecardSection` branch (title `Group N`, `teamAId`/`teamBId` derived from the group's distinct `team_id`s, results filtered by `tournament_group_id === g.id`).
- Match Players mode reuses the existing per-match branch, plus the pooled "Round match — all groups" section when `isRoundLevelGameType` applies and there are no explicit matches.
- The existing `?group=` / `?match=` focus params on the viewer page keep priority over the toggle.
- No database, RLS, scoring, or engine changes — presentation only.
