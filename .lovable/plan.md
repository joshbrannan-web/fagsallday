
## Bug: Double-delete required for mid-round deletion

### Root Cause

When `handleDeleteRound` runs in `RoundSummary.tsx`, it calls two functions sequentially:

1. `deleteRound(roundId)` — removes the round from the `rounds` array via `setRounds(prev => prev.filter(...))` and sets `currentRound` to `null`
2. `clearLoadedRound()` — resets `loadedRoundIdRef` then searches `rounds` for an active round and sets it as `currentRound`

The problem is that `clearLoadedRound` reads the **stale** `rounds` state (React hasn't re-rendered yet after `deleteRound`'s `setRounds` call). It finds the just-deleted round still present with status `ACTIVE`, and re-assigns it as `currentRound`. This resurrects the round in the UI, requiring the user to delete it a second time.

### Fix

**File: `src/hooks/useRounds.tsx`** — Update `deleteRound` to also clear `loadedRoundIdRef`:

```typescript
const deleteRound = async (roundId: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('rounds')
        .delete()
        .eq('id', roundId)
        .eq('user_id', user.id);
      if (error) throw error;

      loadedRoundIdRef.current = null;  // <-- ADD THIS LINE
      setRounds(prev => prev.filter(r => r.id !== roundId));
      if (currentRound?.id === roundId) {
        setCurrentRound(null);
      }
      toast.success('Round deleted');
      return true;
    } catch (error) { ... }
};
```

**File: `src/components/RoundSummary.tsx`** — Remove the redundant `clearLoadedRound()` call that causes the race condition:

```typescript
const handleDeleteRound = async () => {
    if (!window.confirm('Delete this round? This cannot be undone.')) return;
    await deleteRound(currentRound.id);
    navigate('/');
};
```

This ensures the round is fully removed in one operation without `clearLoadedRound` accidentally restoring it from stale state.
