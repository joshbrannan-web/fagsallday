

# Auto-Activate Tournament on First Round Start

## What
When a player starts the first group/round in a tournament that's still in `setup` status, automatically promote the tournament to `active`.

## How

### `src/hooks/useTournamentRoundSetup.ts`
In the `startRound` callback, after the group and round are successfully created, check if the tournament status is `setup`. If so, update it to `active`:

```typescript
// After group creation succeeds, auto-activate tournament
if (tournament.status === 'setup') {
  await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournament.id);
}
```

This goes right after the `tournament_group_players` insert, before `refetchRounds()`.

### Note on permissions
The `tournaments` UPDATE policy requires `created_by = auth.uid() AND is_tournament_admin()`. If a non-creator member starts a round, this update will silently fail (no error thrown, just no rows affected). This is acceptable — the creator/admin can still manually activate. Alternatively, we can make it a fire-and-forget call so it doesn't block round creation.

**1 file changed:** `src/hooks/useTournamentRoundSetup.ts`

