

# Auto-Activate Tournament Round + Tournament Status

## What
When any player starts a group/round, automatically:
1. Set the parent `tournament_round` status from `pending` to `active`
2. Set the `tournament` status from `setup` to `active` (already implemented)

## How

### `src/hooks/useTournamentRoundSetup.ts`
Add one block right before the existing tournament auto-activate code (~line 351):

```typescript
// Auto-activate tournament round if still pending
if (selectedRound.status === 'pending') {
  await supabase
    .from('tournament_rounds')
    .update({ status: 'active' })
    .eq('id', selectedRound.id);
}
```

The existing `tournament_rounds` RLS policy "Creator full access" allows the creator to update. For non-creator members, the update will silently fail (acceptable — admin can activate manually). The tournament auto-activate block on line 351 already handles the tournament-level status change.

**1 file changed:** `src/hooks/useTournamentRoundSetup.ts`

