# Stop treating a failed network request as proof data is gone

Two launch-time paths can destroy a live round when the phone briefly loses signal. Both get the same rule: only act on a confirmed answer from the server.

## Fix 1 — Landing self-heal (src/components/Landing.tsx)

The tournament-existence check currently reads only `data` and deletes the round plus its local cache when `data` is null. A dropped request returns `{ data: null, error }`, so bad cell service permanently deletes a live round.

Change `checkTournament` to:
- Return early when `navigator.onLine` is false.
- Destructure `error` as well; on error, log a warning and leave the round intact.
- Delete the round and clear the cache only when the query succeeds and returns no tournament.

## Fix 2 — Launch session validation (src/hooks/useAuth.tsx)

Inside the initial `getSession().then(...)` block, `getUser()` errors are all treated as a stale token, so launching offline signs the user out and hides the in-progress round.

Change it to match the 30-minute health check already in the file:
- If `navigator.onLine` is false, trust the cached session: set session/user, finish loading, mark validation done, fetch profile best-effort, return.
- Otherwise call `getUser()` and classify the error: `AuthRetryableFetchError`, or a status that is undefined/0/>=500, counts as a network failure — warn, keep the cached session signed in, and return.
- Only a genuine auth rejection clears state; in that case, if a cached ACTIVE round exists, show a warning toast that the round is saved on the device.
- The success path (set session/user, fetch profile) stays exactly as it is.

## Out of scope

No changes to scoring, the sync queue, caching logic, the periodic health check, inactivity/expiry timers, or `signOut`. No migration.
