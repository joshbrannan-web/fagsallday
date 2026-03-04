

# Plan: Fix Tournament Round Deletion — Silent Supabase Errors

## Root Cause

The `handleConfirmTournamentDelete` function (line 192-205) does not check the `error` return from each Supabase delete call. The Supabase JS client does **not throw** on query errors — it returns `{ data, error }`. The `try/catch` block only catches network-level exceptions, not query failures (like RLS policy denials).

So when the tournament cleanup queries silently fail (likely RLS policy denials), the code proceeds to `deleteRound(currentRound.id)`, which hits the FK constraint because `tournament_groups` still exists. The success toast fires unconditionally after the `catch` block regardless.

## Fix

### `src/components/RoundSummary.tsx` — `handleConfirmTournamentDelete` (lines 192-205)

Check the `error` property from each Supabase delete call. If any fail, show an error toast and abort before calling `deleteRound`. Also move the success toast inside a success path.

```typescript
const handleConfirmTournamentDelete = async () => {
  setShowDeleteConfirm(false);
  try {
    const { error: e1 } = await supabase.from('tournament_hole_results').delete().eq('tournament_group_id', tournamentGroupId);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('tournament_hole_scores').delete().eq('tournament_group_id', tournamentGroupId);
    if (e2) throw e2;
    const { error: e3 } = await supabase.from('tournament_group_players').delete().eq('tournament_group_id', tournamentGroupId);
    if (e3) throw e3;
    const { error: e4 } = await supabase.from('tournament_groups').delete().eq('id', tournamentGroupId);
    if (e4) throw e4;

    await deleteRound(currentRound.id);
    toast.success('Tournament round deleted');
    navigate('/');
  } catch (err) {
    console.error('Error deleting tournament round:', err);
    toast.error('Failed to delete round');
  }
};
```

This ensures:
1. Each Supabase delete is verified before proceeding
2. If any cleanup step fails, the round delete is skipped (preventing the FK error)
3. Only one toast appears (success or error, not both)

If the RLS DELETE policies from the earlier migration weren't applied or aren't matching, the error will now be properly surfaced. In that case, we may also need to debug the RLS policies — but this code fix is required regardless to handle errors correctly.

| Resource | Change |
|---|---|
| `src/components/RoundSummary.tsx` | Check Supabase error returns in `handleConfirmTournamentDelete`; abort on failure |

1 function rewritten, 0 new files, 0 database changes.

