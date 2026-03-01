

## Plan: Add Delete and Lock/Unlock to Tournament Mode

Mirror the existing round management patterns (delete with confirmation dialog, lock/unlock status) for tournaments.

### 1. Add `deleteTournament` and `lockTournament`/`unlockTournament` to `useTournament.tsx`

- `deleteTournament(id)`: Delete from `tournaments` table (cascade will remove players/rounds). Show toast.
- `lockTournament()`: Update tournament status to `'COMPLETE'` (equivalent of locked — prevents further edits). Note: the DB enum is `tournament_status` with values `SETUP`, `ACTIVE`, `COMPLETE`. We don't need a new `LOCKED` status — `COMPLETE` serves the same purpose as locked.
- `unlockTournament()`: Set status back to `'ACTIVE'`.

### 2. Update `TournamentList.tsx` — Delete tournaments

- Add delete button (trash icon) on each tournament card (only for tournaments the user created)
- Add `AlertDialog` confirmation dialog matching the pattern in `RoundHistory.tsx`
- Call `deleteTournament` on confirm, remove from local state
- Show LOCKED/COMPLETE badge on tournament cards (matching round card badges)

### 3. Update `TournamentDashboard.tsx` — Lock/Unlock + Delete

- Add Lock button when status is `ACTIVE` or after completing (like `RoundSummary.tsx` pattern with `window.confirm`)
- Add Unlock button when status is `COMPLETE` (returns to `ACTIVE`)
- Add Delete button with `AlertDialog` confirmation (creator only)
- After delete, navigate back to `/tournament`
- Show lock icon in header when tournament is `COMPLETE`

### 4. Add RLS policy for DELETE on `tournaments` table

- The existing `ALL` policy for creator covers DELETE, so no migration needed. The `Creator can do everything on own tournaments` policy with `USING (auth.uid() = creator_id)` already covers SELECT, INSERT, UPDATE, and DELETE.

### Files to Modify
- `src/hooks/useTournament.tsx` — add `deleteTournament`
- `src/pages/TournamentList.tsx` — delete button + confirmation dialog + status badges
- `src/pages/TournamentDashboard.tsx` — lock/unlock/delete buttons with confirmation dialogs

