

## Tournament Admin: Full Edit & Delete

### Current State
The dashboard already supports editing basic info (name, description, dates, status), rounds (inline RoundConfigCard), players (handicap overrides, team reassignment, add/remove), and teams (rename, recolor, add/delete). What's missing is **delete** and **add/remove rounds**.

### Database Migration

Add a DELETE RLS policy on `tournaments`:
```sql
CREATE POLICY "Tournament creator can delete their tournaments"
ON public.tournaments FOR DELETE
USING (created_by = auth.uid() AND is_tournament_admin());
```

All child tables already have `ON DELETE CASCADE` from `tournaments`, so deleting the tournament row automatically removes teams, players, rounds, games, groups, scores, results, scoreboards, and members.

### Hook: `src/hooks/useTournamentDetail.ts`

Add three functions:
- **`deleteTournament()`** — deletes the tournament row (cascade handles children), returns success boolean
- **`addRound(roundNumber)`** — inserts a new `tournament_rounds` row + default `tournament_games` row, refetches
- **`deleteRound(roundId)`** — deletes a round (cascade removes its game, groups, scores, results), refetches

### UI: `src/pages/TournamentAdminDashboard.tsx`

1. **Delete Tournament** — Add a red "Delete Tournament" button at the bottom of the Edit Tournament sheet. Clicking it opens an `AlertDialog` requiring confirmation. On confirm, calls `deleteTournament()` and navigates to `/tournament-admin`.

2. **Add Round** — Add an "Add Round" button below the rounds list in the Rounds tab. Calls `addRound(rounds.length + 1)`.

3. **Delete Round** — Add a trash icon button on each round card (next to the edit pencil). Clicking opens an AlertDialog confirmation, then calls `deleteRound(roundId)`.

### Files Modified
- Database migration — add DELETE policy on `tournaments`
- `src/hooks/useTournamentDetail.ts` — add `deleteTournament`, `addRound`, `deleteRound`
- `src/pages/TournamentAdminDashboard.tsx` — add delete tournament button + confirmation, add/delete round UI

