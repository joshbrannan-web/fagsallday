

## Auto Sign-Out After 24 Hours (Unless Round Active)

### What changes

The app will automatically sign the user out if their session has been active for more than 24 hours, ensuring they always reload the latest app version. If an active round is in progress, the sign-out is deferred until the round completes.

### How it works

1. On login, store the sign-in timestamp in localStorage (e.g., `fg_session_start`)
2. A `useEffect` in `AuthProvider` runs an interval (every 60 seconds) that checks:
   - Is the session older than 24 hours?
   - Is there currently an active round? (check `offlineStorage.getCachedRound()` for an ACTIVE status)
3. If session is expired AND no active round: call `signOut()` and show a toast ("Session expired -- please sign in again"), then clear the timestamp
4. If session is expired BUT a round is active: skip sign-out (the user finishes their round uninterrupted)
5. After the round finishes, the next interval tick will catch the expired session and sign out

### Technical details

**File: `src/hooks/useAuth.tsx`**

1. **Store login timestamp** -- In the `onAuthStateChange` callback, when `event === 'SIGNED_IN'`, write `Date.now()` to `localStorage` under key `fg_session_start`. On `SIGNED_OUT`, remove the key.

2. **Add session expiry check** -- Inside the `useEffect` that sets up auth, add a `setInterval` (60-second tick):
   ```typescript
   const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

   const intervalId = setInterval(() => {
     const sessionStart = localStorage.getItem('fg_session_start');
     if (!sessionStart) return;

     const elapsed = Date.now() - Number(sessionStart);
     if (elapsed < SESSION_MAX_AGE) return;

     // Check for active round
     const cached = offlineStorage.getCachedRound();
     if (cached && cached.status === 'ACTIVE') return; // defer

     // Expired and no active round -- sign out
     supabase.auth.signOut();
     localStorage.removeItem('fg_session_start');
     toast.info('Session expired. Please sign in again to get the latest updates.');
   }, 60_000);
   ```
   Return cleanup: `clearInterval(intervalId)` in the effect's teardown.

3. **Import dependencies** -- Add imports for `offlineStorage` and `toast` (sonner) at the top of the file.

### Files to modify
- `src/hooks/useAuth.tsx` (single file change)

