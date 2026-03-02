

## Fix: Stale Session Causing Lost Rounds

### Root Cause

There are two interrelated bugs:

1. **Race condition on app load**: `onAuthStateChange` fires immediately with a cached (potentially expired) session from localStorage, setting `user` state and `isLoading=false` before `getUser()` server validation completes. The app renders as "logged in" even when the token is expired.

2. **Silent auth failure masking**: In `useRounds.updateRound()`, when a Supabase write fails (e.g., 401 from expired token), the error is caught and silently queued to the offline sync queue. The user sees no error — they think their round saved. Only when they try to navigate or perform another action does the auth state finally update, and the queued data is lost because the session can never be restored.

### Plan

**File: `src/hooks/useAuth.tsx`**

- Add a `validatingRef` (or state flag) that starts `true` and prevents the app from rendering authenticated content until `getUser()` completes.
- In the `onAuthStateChange` callback, do NOT set `user`/`session` for `INITIAL_SESSION` events — let the `getSession().then(getUser())` path be the single source of truth on first load.
- After `getUser()` succeeds, set user/session. After it fails, call `supabase.auth.signOut()` to clear the stale localStorage token (currently it just nulls React state but leaves the stale token in localStorage, so next reload the same problem recurs).
- Add a periodic `getUser()` health check (every ~30 minutes while the tab is visible) during an active round. If it fails, show a warning toast ("Session expired — your scores are saved locally, please sign in to sync") rather than silently breaking.

**File: `src/hooks/useRounds.tsx`**

- In `updateRound()`, inspect the Supabase error. If it's an auth error (status 401/403 or message contains "JWT"), do NOT silently queue — instead show a toast warning the user their session expired and scores are being saved locally. Set a flag or dispatch an event so the auth provider can re-check.
- In `finishRound()` / `lockRound()`, if the user is not authenticated at the time of the call, show a clear error: "Please sign in to save your round" with the offline-cached data preserved.

**File: `src/hooks/useAuth.tsx` — signOut on stale session**

- When `getUser()` returns an error on initial load, also call `supabase.auth.signOut()` to clear the stale refresh token from localStorage. Currently it only clears React state, so the next page load hits the same issue.

### Files Modified
- `src/hooks/useAuth.tsx` — fix race condition, clear stale tokens, add periodic revalidation
- `src/hooks/useRounds.tsx` — detect auth errors vs network errors in updateRound, surface to user

### Files NOT Modified
- `public/sw.js` — already correctly skips `/auth/` and `/rest/` paths
- `src/services/offlineStorage.ts` — unchanged, continues to work as local cache

