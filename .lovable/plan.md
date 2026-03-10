

# Fix Tournament Pairings Groups Not Persisting

## Problem
When the admin creates multiple pairing groups, only 1 group persists in the database. The root cause is that `addGroup` in `useTournamentDetail.ts` calculates `nextGroupNumber` from the local React `groups` state, which can be stale due to React 18's batched rendering. Additionally, the function lacks error logging, making failures invisible.

## Changes

### 1. `src/hooks/useTournamentDetail.ts` — Fix `addGroup` function

**Use a database-level count query** instead of local state to determine the next group number (matching the pattern already used in `useTournamentRoundSetup.ts` line 302-305):

```typescript
const addGroup = async (roundId: string, playerIds: string[], subMatchups?: ...) => {
  // DB count instead of stale local state
  const { count } = await supabase
    .from('tournament_groups')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_round_id', roundId);
  const nextGroupNumber = (count || 0) + 1;
  
  // ... rest of insert logic unchanged, but add console.error for failures
  if (groupErr || !newGroup) {
    console.error('Failed to create group:', groupErr);
    toast.error('Failed to create group');
    return;
  }
  
  // ... group players insert, also add console.error
  if (gpErr) {
    console.error('Failed to add group players:', gpErr);
    toast.error('Group created but failed to add players');
  }
  
  await fetchAll();
};
```

**1 file changed.** The key fix replaces `groups.filter(...)` (stale closure) with a fresh DB query, and adds error logging for debugging.

