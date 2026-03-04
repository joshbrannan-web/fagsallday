

# Plan: Tournament Mode Piece 6 — Live Scoreboards

## Scope
Replace placeholder scoreboards with full rendering for all 6 scoreboard types, add a read-only group scorecard page, live toast notifications, auth guard, and a comprehensive data hook with realtime subscriptions.

## Files to Create (15)

### `src/services/scoreboardCalculations.ts`
Pure calculation helpers: `calcTeamTotals`, `calcTeamTotalsPerRound`, `calcPlayerGrossPerRound`, `calcPlayerNetPerRound`, `calcThru`, `rankWithTies`, `playerHasOverride`. Directly from the spec — no Supabase calls, just math over typed data.

### `src/components/scoreboards/ScoreboardSelector.tsx`
Dropdown (using Select component) showing all configured scoreboards by name in display_order. Props: `scoreboards`, `selectedId`, `onSelect`. Shows chart icon + selected name.

### `src/components/scoreboards/ScoreboardRenderer.tsx`
Switch on `scoreboard_type` to render the correct scoreboard component. Receives full data from hook + selected scoreboard config. Maps to one of the 6 scoreboard components.

### `src/components/scoreboards/TeamPointsScoreboard.tsx`
Container for team_points type. Renders `RyderCupGraphic` + collapsible `TeamPointsBreakdownTable`.

### `src/components/scoreboards/RyderCupGraphic.tsx`
Visual card: team names in caps with colors, large point totals (text-5xl, leading team in gold), split progress bar, per-round breakdown rows (completed with ✓, active with green dot, not-started hidden). Shows "🏆 TEAM X WINS" when tournament complete.

### `src/components/scoreboards/TeamPointsBreakdownTable.tsx`
Collapsible table behind "Show Breakdown" toggle. Round rows expandable to show group results. Group rows show abbreviated player names, points per side, result label. Tap group row navigates to read-only group scorecard.

### `src/components/scoreboards/IndividualGrossScoreboard.tsx`
Ranked table: Pos, Player, Team dot, HCP, R1..RN (started rounds only), Total, Thru. Sorted ascending by gross. Ties prefixed with "T". Override asterisk styling. Top 3 colored left borders.

### `src/components/scoreboards/IndividualNetScoreboard.tsx`
Same structure as gross but uses net score calculation (gross - strokesReceived per hole). Sorted ascending by net total.

### `src/components/scoreboards/IndividualPointsScoreboard.tsx`
Same table structure but value = points earned from `player_points`. Sorted descending.

### `src/components/scoreboards/TeamRoundResultScoreboard.tsx`
Aggregate table: Round, Team A Pts, Team B Pts, Result. Expandable rows showing group breakdowns with `GroupResultRow`. Total row at bottom.

### `src/components/scoreboards/GroupResultRow.tsx`
Expandable row within team round result. Shows player names, points per side, result. Tap navigates to group scorecard route.

### `src/components/scoreboards/IndividualRoundResultScoreboard.tsx`
Table: Player, Team, R1 (W/L/H with match result), R2, ..., Total W-H-L. Sorted by wins desc, halves desc.

### `src/components/scoreboards/TournamentLiveToast.tsx`
Fixed-position toast component. Receives `newHoleResult` from hook. Shows player name + hole number + updated team lead status. Team color left border. Auto-dismiss after 4s. Only fires for active rounds, not initial load.

### `src/pages/TournamentGroupScorecard.tsx`
Read-only group scorecard page at `/tournament/:joinCode/round/:roundId/group/:groupId`. Fetches group data, scores, results. Renders a read-only version of the scorecard grid (reuses `TournamentFullScorecard` from Piece 5 or renders a simplified read-only grid). Back button to scoreboards. No editing controls.

### Route addition in `src/App.tsx`
Add: `/tournament/:joinCode/round/:roundId/group/:groupId` → `TournamentGroupScorecard`

## Files to Modify (3)

### `src/hooks/useTournamentScoreboards.ts` — Full Rewrite
Replace placeholder with comprehensive data hook:
- Fetches all 11 tables on mount (scoreboards, rounds, teams, players, games, hole_points, groups, group_players, hole_results, hole_scores)
- Data keyed for efficient lookup: groups by round_id, groupPlayers by group_id, holeResults by group_id then hole_number, holeScores flat array
- Realtime subscriptions on `tournament_hole_results` and `tournament_hole_scores` — on event, re-fetch only those two tables (incremental)
- Subscription on `tournament_rounds` for status changes
- Tracks `newHoleResult` for toast (set on realtime INSERT/UPDATE, cleared after 4s)
- `isInitialLoad` ref to suppress toast on first data load
- Returns: tournament, teams, players, rounds, games, scoreboards, groups, groupPlayers, holeResults, holeScores, holePoints, isLoading, isLive, newHoleResult, lastUpdated

### `src/pages/TournamentScoreboards.tsx` — Replace Content
- Add auth guard: check `useAuth().user`, redirect to `/auth` with return URL if not logged in
- Auto-join: if user not in `tournament_members`, insert on mount
- Replace `TournamentScoreboardTabs` with `ScoreboardSelector` + `ScoreboardRenderer`
- Add `selectedScoreboard` state (default first by display_order)
- Add `TournamentLiveToast` component
- Add gold completion banner when tournament status = 'completed'
- Update header: show round progress "Round X of Y", live badge logic

### `src/App.tsx` — Add Route
Add one route line for the group scorecard page.

## Data Flow
```text
useTournamentScoreboards (hook)
  ├── initial fetch of 11 tables
  ├── realtime on hole_results/hole_scores → incremental re-fetch
  └── newHoleResult state for toast
       ↓
TournamentScoreboards (page)
  ├── ScoreboardSelector (dropdown)
  ├── ScoreboardRenderer (switch)
  │     └── [specific scoreboard component]
  │           └── scoreboardCalculations.ts (pure math)
  └── TournamentLiveToast (fixed overlay)
```

## Key Edge Cases
- No rounds started: show 0—0 graphic with "Tournament has not started yet"
- Partial scores: included in rankings, marked italic + "Thru X"
- Super user overrides: asterisk on player total, footnote at bottom
- Tournament complete: gold banner, no live badge, no toast, "🏆 TEAM X WINS" in graphic
- Player missed round: null in that round column, shown as "—"

## Styling
All per the spec: Ryder Cup graphic with text-5xl gold totals, split progress bar, leaderboard tables with font-mono scores, W/L/H badges with green/red/muted colors, top-3 left borders (gold/silver/bronze), live toast with team color accent bar.

