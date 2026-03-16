

# Revised Plan: Hard Reset on Sign-Out — With Active Round Protection

## The Risk
The original plan purges everything (SW, caches, localStorage) during `signOut()`. If a player is mid-round, this destroys their cached scores and sync queue. Even though auto-logout timers already skip sign-out when a round is active, a **manual** sign-out does not.

## Revised Approach

Split sign-out into two paths:

### Path A — No active round (normal sign-out)
Full hard reset: unregister SW, purge Cache Storage, clear all localStorage, hard reload. This is the original plan and ensures users get the latest version on next sign-in.

### Path B — Active round in progress
1. **Preserve round data**: Do NOT clear `fg_offline_round` or `fg_sync_queue`.
2. **Still sign out of auth** (clear session tokens).
3. **Skip** SW unregister and cache purge — the player may be offline and needs cached assets to keep the app running.
4. **Show a warning toast**: "You have an active round. Your scores are saved locally — sign back in to sync."
5. On next sign-in, the existing round recovery logic (`RoundRecovery` component) will detect the cached round and offer to resume or discard it. The sync manager will process the queue.

### Changes — `src/hooks/useAuth.tsx`

```ts
const signOut = async () => {
  const cached = offlineStorage.getCachedRound();
  const hasActiveRound = cached && cached.status === 'ACTIVE';

  // Always clear auth state
  setUser(null);
  setSession(null);
  setProfile(null);
  try { await supabase.auth.signOut(); } catch {}

  if (hasActiveRound) {
    // Preserve round data + sync queue, just clear session keys
    localStorage.removeItem('fg_current_round');
    localStorage.removeItem('fg_history');
    localStorage.removeItem('fg_saved_courses');
    localStorage.removeItem('fg_session_start');
    localStorage.removeItem('fg_last_activity');
    toast.warning('Active round preserved locally. Sign back in to sync your scores.', { duration: 8000 });
  } else {
    // Full hard reset
    offlineStorage.clearCachedRound();
    offlineStorage.clearSyncQueue();
    offlineStorage.clearTournamentSyncQueue();
    localStorage.removeItem('fg_current_round');
    localStorage.removeItem('fg_history');
    localStorage.removeItem('fg_saved_courses');
    localStorage.removeItem('fg_session_start');
    localStorage.removeItem('fg_last_activity');
    localStorage.removeItem('fg_build_hash');

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    // Purge all cached assets
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    // Hard reload to fetch fresh assets
    window.location.reload();
  }
};
```

### No other file changes needed
- `main.tsx` already re-registers the SW on load, so it will be reinstalled after the hard reload.
- `useVersionCheck.ts` will see no `fg_build_hash` and simply store the current one — no spurious sign-out.
- Round recovery on sign-in already handles the "active round in localStorage" case.

## Summary
| Scenario | Round data | SW + Cache | Reload |
|---|---|---|---|
| Sign out, no active round | Cleared | Purged + unregistered | Yes |
| Sign out, active round | Preserved | Kept | No |

