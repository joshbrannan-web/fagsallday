

## Bug: Stale Round Recovery After Logout

### Root Cause
When a user signs out, the offline cached round (`fg_offline_round` in localStorage) is never cleared. On the next page load, `RoundRecovery` finds this stale cached round, treats the user as unauthenticated, sets it as the local current round, and auto-navigates to `/active`.

### Fix

**1. Clear offline cache on sign-out** (`src/hooks/useAuth.tsx`)

In the `signOut` function, add `offlineStorage.clearCachedRound()` alongside the existing localStorage cleanup. This is the primary fix — when a user intentionally signs out, their cached round should not persist.

**2. Guard `RoundRecovery` against unauthenticated users** (`src/App.tsx`)

Add an early return in the `RoundRecovery` useEffect: if `!isAuthenticated` and `authLoading` is false, skip recovery entirely. Unauthenticated users returning to the app shouldn't auto-resume rounds from a previous authenticated session. This acts as a safety net in case the cache wasn't properly cleared.

Both changes are small — one line added to `signOut`, one guard condition added to the recovery effect.

