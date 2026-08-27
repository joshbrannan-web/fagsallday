# Scorecard & Results buttons in Rounds & Matchups

The "Rounds & Matchups" list appears under every scoreboard (Team Points, Live Group Matches, Team Round Results) on the tournament view page. Add scorecard access there at two levels.

## What changes

1. **Per round card** — a "View Scorecard & Results (Round)" button in each round's header area. Opens the existing read-only round results page showing every group/match for that round, plus the round points award.

2. **Per pairing row** — each pairing line (G1, G2, ...) gets a "View Scorecard & Results (Match)" button. Opens the same page but focused on just that pairing: only that group's (or that cross-group match's) scorecard section, hole winners, strokes and match status.

3. Buttons only show for rounds that have started (active or completed). For not-started rounds nothing is shown.

4. On the focused view the header reads e.g. "Round 2 — Match: Erik, Kurt, Paul vs Josh" and a "View full round" link switches back to the all-groups view.

## Technical notes

- `src/pages/TournamentScoreboards.tsx`: add the round-level button to each round `Card`, and a compact icon/text button on each pairing row. Navigation targets the existing route `/tournament/:joinCode/round/:roundId/results`, with the pairing button appending `?group=<groupId>` (or `?match=<matchId>` when the round uses cross-group matches).
- `src/pages/TournamentViewRoundScorecard.tsx`: read `group` / `match` from `useSearchParams`. When present, render only the matching `TestScorecardSection` (filter the `matches` or `groups` array) and keep the round award card hidden for a single-match focus unless the round is scored per match. Add the "View full round" button that clears the query param.
- Pairing rows already have `group.id` in scope; for rounds with cross-group matches, map the row to its `RoundMatch` via the existing `roundMatches` data already returned by `useTournamentScoreboards`, falling back to `?group=` when no match id matches.
- No database, RLS, or scoring changes; read-only presentation only.
