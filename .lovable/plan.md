

# Add Tournament Scoreboards to Player's Tournament Tab

## Goal
Show all admin-configured scoreboards below the "Full Scorecard" button in the `TournamentTabPanel`, so players can view live standings without leaving the active round.

## Approach
The `TournamentTabPanel` doesn't currently know the `tournamentId`. We'll pass it down, then fetch scoreboards using `useTournamentScoreboards` and render them with the existing `ScoreboardRenderer` + `ScoreboardSelector`.

## Data Flow
`_TOURNAMENT_META.tournamentId` → `ActiveRound` extracts it → passes to `TournamentTabPanel` → panel uses `useTournamentScoreboards(tournamentId)` to fetch all scoreboards, rounds, teams, players, results → renders via `ScoreboardSelector` + `ScoreboardRenderer`.

## Changes

### 1. `src/components/ActiveRound.tsx`
- Extract `tournamentId` from meta (already available as `meta?.tournamentId`)
- Pass `tournamentId` as new prop to `TournamentTabPanel`

### 2. `src/components/tournament/TournamentTabPanel.tsx`
- Add `tournamentId?: string` prop
- Import `useTournamentScoreboards`, `ScoreboardSelector`, `ScoreboardRenderer`
- After the Full Scorecard modal, add a "Scoreboards" section:
  - Use `useTournamentScoreboards(tournamentId)` to fetch data
  - Show `ScoreboardSelector` if multiple scoreboards exist
  - Render `ScoreboardRenderer` for the selected scoreboard
  - Show a loading spinner while fetching
  - Show nothing if no scoreboards configured
- Also need `joinCode` — we can fetch it from the tournament lookup already done in the hook, or pass it as a prop. Simplest: pass it down from ActiveRound (available from meta or the overlay hook's initial fetch). Actually, `useTournamentScoreboards` doesn't fetch the tournament itself. We can derive the join code by adding a small fetch, or just pass an empty string since it's only used for share links in some scoreboards and isn't critical here.

### 3. `src/pages/TournamentAdminLiveView.tsx`
- Also pass `tournamentId` prop to its `TournamentTabPanel` usage for consistency

3 files changed, 0 database changes.

