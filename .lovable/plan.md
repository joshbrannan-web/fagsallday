

# Fix: Stale Tournament Round Showing After Tournament Deletion

## Problem
Josh Brannan sees "Resume Tournament Round" on the home screen even after the tournament admin deleted the tournament. The round record still exists in the `rounds` table (owned by Josh via `user_id`), so `useRounds.fetchRounds()` returns it as an ACTIVE round. The `RoundRecovery` component never runs its verification because `currentRound` is already set from the DB fetch.

**Root cause**: The `delete-tournament-rounds` edge function may not have been invoked for this tournament (it was deleted before the wiring was added), OR the PostgREST JSON path filter didn't match. Either way, the round persists in the DB.

## Two-Part Fix

### 1. Immediate data fix — Delete the orphaned round
Query the `rounds` table for ACTIVE rounds with `_TOURNAMENT_META` pointing to a tournament that no longer exists, and delete them. This cleans up the current state.

Use `supabase--read_query` to find orphaned rounds:
```sql
SELECT r.id, r.user_id, r.game_data->'_TOURNAMENT_META'->>'tournamentId' as tid
FROM rounds r
WHERE r.status = 'ACTIVE'
  AND r.game_data->'_TOURNAMENT_META'->>'tournamentId' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tournaments t 
    WHERE t.id = (r.game_data->'_TOURNAMENT_META'->>'tournamentId')::uuid
  );
```

Then delete those orphaned rounds via a migration.

### 2. Defensive check in Landing.tsx
Add a lightweight check: when `currentRound` has `_TOURNAMENT_META` and status is `ACTIVE`, verify the tournament still exists. If not, silently finish/clear the round.

**File changed**: `src/components/Landing.tsx`
- Add a `useEffect` that runs when `currentRound` has tournament metadata
- Query `tournaments` table for the referenced `tournamentId`
- If not found, call `finishRound()` or `deleteRound(currentRound.id)` to clean up
- This acts as a self-healing mechanism for any future orphaned rounds

### Technical Detail

In `Landing.tsx`, after the existing `useEffect` for `clearLoadedRound`:

```typescript
useEffect(() => {
  if (!user || !currentRound || currentRound.status !== 'ACTIVE') return;
  const meta = (currentRound.gameData as any)?._TOURNAMENT_META;
  if (!meta?.tournamentId) return;

  const checkTournament = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', meta.tournamentId)
      .maybeSingle();

    if (!data) {
      // Tournament was deleted — clean up the orphaned round
      await deleteRound(currentRound.id);
      offlineStorage.clearCachedRound();
    }
  };
  checkTournament();
}, [user, currentRound]);
```

This ensures that even if the edge function misses a round, the player's app self-heals on next visit.

