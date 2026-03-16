

# Move Tournament Offline Drain to App.tsx

## Problem
The tournament score drain logic lives in `useTournamentOverlay`, which only mounts when `ActiveRound` with a tournament overlay is visible. If the user navigates away (e.g., to scoreboards) after coming back online, queued scores never flush.

## Changes

### 1. `src/App.tsx` — Add tournament drain effect (after line 235)

Add a new `useEffect` that mirrors the existing round sync pattern (lines 200-235) but for tournament scores:

```ts
// Drain tournament sync queue when coming back online
useEffect(() => {
  if (!isOnline || !isAuthenticated) return;
  
  const drainTournamentQueue = async () => {
    const queue = offlineStorage.getTournamentSyncQueue();
    if (queue.length === 0) return;

    const successIds: string[] = [];
    for (const item of queue) {
      try {
        const { error } = await supabase.from('tournament_hole_scores').upsert({
          tournament_group_id: item.tournamentGroupId,
          tournament_player_id: item.tournamentPlayerId,
          hole_number: item.holeNumber,
          gross_score: item.grossScore,
          is_super_user_override: false,
        }, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' });
        if (!error) successIds.push(item.id);
      } catch (e) {
        console.warn('Failed to drain tournament sync item:', e);
      }
    }
    if (successIds.length > 0) {
      offlineStorage.removeTournamentSyncItems(successIds);
      toast.success(`Synced ${successIds.length} tournament scores`);
    }
  };

  drainTournamentQueue();
}, [isOnline, isAuthenticated]);
```

### 2. `src/hooks/useTournamentOverlay.ts` — Remove drain logic (lines 389-428)

Delete the `wasOfflineRef` declaration and the entire drain `useEffect` (lines 389-428). The drain is now handled globally in App.tsx. Keep the `isOnline` import since it's no longer needed — actually check if `useOnlineStatus` is still used elsewhere in the hook... it's only used for the drain, so remove that import and the `isOnline` variable too (line 10 import, line 39 usage).

Wait — `isOnline` is only referenced in the drain effect. Remove:
- Line 10: `import { useOnlineStatus } from '@/hooks/useOnlineStatus';`  
- Line 39: `const isOnline = useOnlineStatus();`
- Lines 389-428: the entire drain effect + `wasOfflineRef`

