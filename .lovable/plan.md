

# Plan: Tournament Scorecard Table in Betting Games Section

## Goal
Replace the current `TournamentMatchTracker` (dots + status text) in the Scorecard view with a proper scorecard-style table showing holes, player teams, scores per hole, and hole winners — matching the look of the main scorecard and other betting game sections.

## What the user sees now
A gold-bordered card with: status text ("Team A 3 UP — Thru 12"), 18 colored dots, and team point totals. No per-hole detail, no player names, no scores.

## What we'll build
A new `TournamentScorecardTable` component rendered inside the existing gold-bordered tournament card. It will show:

1. **Header row**: Hole numbers (matching front/back 9 view toggle already in Scorecard)
2. **Player rows**: Each tournament player with their team color indicator, showing their gross score per hole (styled like the main scorecard — par-relative shapes)
3. **Result row**: For each hole, show which team won (colored dot) or "½" for halved — similar to the P&L row pattern
4. **Summary**: Keep the match status text and team totals at the bottom

The data is already available from `useTournamentOverlay`: `tournamentPlayers`, `teamAssignments`, `teams`, `holeResults` (with `grossScores`), `allHoleScores`, `courseHoles`.

## Files

### 1. New: `src/components/tournament/TournamentScorecardTable.tsx`
- Props: `tournamentPlayers`, `teamAssignments`, `teams`, `holeResults`, `allHoleScores`, `courseHoles`, `teamMatchup`, `teamTotals`, `viewMode` (front/back), `matchState`
- Renders a `<table>` with:
  - Header: hole numbers + par (9 holes based on viewMode) + subtotal column
  - One row per player: team color dot + name, score per hole (with par-relative styling), 9-hole subtotal
  - "Result" row at bottom: per-hole winner indicator (team color dot for winner, "½" for halved, "—" for unplayed)
  - Footer summary: match status text + team totals (reusing the logic from TournamentMatchTracker)

### 2. Edit: `src/components/Scorecard.tsx` (lines 1307-1328)
- Replace `TournamentMatchTracker` with `TournamentScorecardTable`, passing `viewMode` and all overlay data
- Pass the existing `viewMode` state so it syncs with the Front 9 / Back 9 toggle
- Import changes: add `TournamentScorecardTable`, can remove `TournamentMatchTracker`

## Data flow
The `useTournamentOverlay` hook already exposes everything needed:
- `tournamentOverlay.tournamentPlayers` — player names + handicaps
- `tournamentOverlay.teamAssignments` — `{ tournamentPlayerId: teamId }`
- `tournamentOverlay.teams` — `{ teamId: { name, color } }`
- `tournamentOverlay.holeResults[holeNum].grossScores` — `{ tournamentPlayerId: score }`
- `tournamentOverlay.courseHoles` — `{ number, par, handicapIndex }[]`
- `tournamentOverlay.teamTotals`, `matchState`

Player mapping (`_TOURNAMENT_META.playerMapping`) maps local player IDs to tournament player IDs — we'll use this to correlate if needed, but the tournament data is self-contained.

2 files (1 new, 1 edit), 0 database changes.

