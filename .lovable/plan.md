

# Wire Up Edge Function in `deleteTournament`

## Overview
Replace the existing manual round cleanup logic in `useTournamentDetail.ts`'s `deleteTournament` with a call to the `delete-tournament-rounds` edge function, plus offline cache cleanup.

## Changes — `src/hooks/useTournamentDetail.ts` only

### Replace `deleteTournament` body (lines 209–249)
The current implementation manually queries `tournament_groups` for linked `round_id`s, checks for active rounds, and deletes them via the client. Replace this with:

1. **Call the edge function** `delete-tournament-rounds` with `{ tournamentId }`. If it errors, abort with a toast and return `{ success: false }`.
2. **Clear offline cache** if the cached round belongs to this tournament (`fg_offline_round` / `fg_sync_queue` in localStorage).
3. **Delete the tournament record** (existing `supabase.from('tournaments').delete()` call).

The `force` parameter and active-round blocking logic are removed since the edge function uses the service role to delete all rounds unconditionally (the admin has already confirmed via the UI).

**1 file changed**: `src/hooks/useTournamentDetail.ts` — `deleteTournament` function rewritten (~40 lines → ~35 lines).

