

# Delete Tournament: Clean Up Linked Rounds + Active Round Warning

## Problem
When a tournament is deleted, the cascade removes tournament tables (groups, scores, etc.) but leaves orphaned rows in the `rounds` table. If a player is mid-round, those rounds become broken (tournament metadata points to deleted groups).

## Approach

### 1. Enhance `deleteTournament` in `useTournamentDetail.ts`

Before deleting the tournament, the function will:

1. **Collect all `round_id` values** from `tournament_groups` for this tournament's rounds (join through `tournament_rounds`).
2. **Check for active rounds** — query the `rounds` table for any of those `round_id`s with `status = 'ACTIVE'`.
3. **If active rounds exist**: Show a warning dialog/toast and return `false` (abort deletion) unless the admin confirms force-delete. The function will accept an optional `force` parameter.
4. **Delete linked rounds** from the `rounds` table using the collected IDs (before the cascade deletes the groups and nullifies the `round_id` references).
5. **Then delete the tournament** (cascade handles the rest).

### 2. Update delete UI in `TournamentAdminDashboard.tsx`

- Add a two-stage confirmation flow:
  - First call `deleteTournament()` without force. If it returns `'active_rounds'`, show an enhanced warning mentioning active rounds.
  - On second confirmation, call `deleteTournament(true)` to force-delete.
- Alternatively, `deleteTournament` can check for active rounds and return a result object `{ success, activeRoundCount }` so the UI can show the appropriate warning.

### Technical Detail

```ts
// In deleteTournament:
const { data: linkedGroups } = await supabase
  .from('tournament_groups')
  .select('round_id, tournament_round_id')
  .in('tournament_round_id', roundIds);

const roundIdsToDelete = linkedGroups
  ?.map(g => g.round_id)
  .filter(Boolean) || [];

if (roundIdsToDelete.length > 0) {
  // Check for active rounds
  const { data: activeRounds } = await supabase
    .from('rounds')
    .select('id')
    .in('id', roundIdsToDelete)
    .eq('status', 'ACTIVE');

  if (activeRounds?.length && !force) {
    return { blocked: true, activeCount: activeRounds.length };
  }

  // Delete linked rounds before cascade
  await supabase.from('rounds').delete().in('id', roundIdsToDelete);
}

// Now delete tournament (cascade handles the rest)
await supabase.from('tournaments').delete().eq('id', tournamentId);
```

### Files Changed
- `src/hooks/useTournamentDetail.ts` — enhanced `deleteTournament` with round cleanup and active-round check
- `src/pages/TournamentAdminDashboard.tsx` — two-stage delete confirmation when active rounds are detected

