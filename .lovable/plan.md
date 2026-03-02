

## Allow Tournament Admin to Edit Published Tournament

Currently the dashboard displays tournament data as read-only. The hooks (`useTournamentDetail`, `useTournaments`) already have update functions (`updateRound`, `updateGame`, `updateTournament`, etc.). The missing piece is UI to trigger edits.

### Changes

**`src/pages/TournamentAdminDashboard.tsx`**

1. **Overview tab — Edit basic info**: Add an "Edit" button next to the tournament name. Tapping it opens a Sheet/dialog with editable fields for name, description, start date, end date, and status. Save calls `updateTournament` from `useTournaments` hook (need to also pull this hook in, or add an `updateTournament` function to `useTournamentDetail`). Simpler approach: add `updateTournament` to `useTournamentDetail` so it's self-contained.

2. **Rounds tab — Edit round config**: Each round card gets an "Edit" button. Tapping it expands to show the full `RoundConfigCard` component pre-populated with the round's current data (mapped from DB fields back to `RoundConfigData`). A "Save" button persists changes via `updateRound` (for round fields) and `updateGame` (for game config fields). Add a helper to map DB round+game data → `RoundConfigData` and another to map `RoundConfigData` → DB updates.

**`src/hooks/useTournamentDetail.ts`**

- Add `updateTournament` function that updates `tournaments` table fields (name, description, start_date, end_date, status) then refetches.

### Implementation Detail

**Mapping DB → RoundConfigData** (for pre-populating edit form):
```
name: round.name
roundDate: round.round_date
courseData: round.course_data
notes: round.notes
gameType: game.game_type
defaultPointsPerHole: game.default_points_per_hole
halvedHoleRule: game.halved_hole_rule
useHandicaps: game.use_handicaps
handicapAllowancePercent: game.handicap_allowance_percent
maxScoreEnabled: !!game.max_score_per_hole
maxScorePerHole: game.max_score_per_hole || 4
secondBallTiebreaker: game.second_ball_tiebreaker
sixesConfig: game.sixes_config || default
holePointOverrides: merge hole_points with defaults
```

**Saving edits**: Split `RoundConfigData` back into `updateRound(roundId, roundFields)` + `updateGame(gameId, gameFields)` calls.

### Files Modified
- `src/hooks/useTournamentDetail.ts` — add `updateTournament`
- `src/pages/TournamentAdminDashboard.tsx` — add edit basic info sheet + edit round inline with RoundConfigCard

