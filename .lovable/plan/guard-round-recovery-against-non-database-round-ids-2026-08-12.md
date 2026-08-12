# Guard round recovery against non-database round ids

A round started while signed out gets a timestamp-style id (`Date.now().toString()`), not a database UUID. Sending that id to the database as an existence probe is invalid, and a failed probe can lead to the cached round being treated as gone.

## Change

In `src/App.tsx`, `RoundRecovery`:

- In the initial recovery effect, before the existence probe, test `cached.id` against the UUID pattern. If it does not match, log a warning and return — skipping the server probe and the auto-resume.
- Do the same in `handleResume` for `recoveryRound.id`.
- In both cases the cached round is left untouched — nothing is cleared or deleted.

```ts
const isDbRoundId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cached.id);
if (!isDbRoundId) {
  console.warn('[recovery] Cached round has a non-database id — skipping server recovery', cached.id);
  return;
}
```

In handleResume, when the id isn't a database UUID, close the dialog and tell the user instead of

just returning — still without clearing the cache:

    setShowRecoveryDialog(false);

    setRecoveryRound(null);

    [toast.info](http://toast.info)("That round was started before you signed in, so it can't be synced to your account.");

    return;  
No other files change.