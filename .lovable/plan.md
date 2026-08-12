# Close two gaps left by today's round-persistence work

Today's changes were all about one thing: scores disappearing from live rounds. Nothing was removed from the app — no screens, games, or settings changed. Two side effects of the new "never lose a score" caching are worth closing.

## Issue 1 — "Change games" can bring old scores back

When you change games mid-round, the scoreboard is cleared on the server. But the device's offline copy still holds the old scores, and the new gap-filling logic treats anything missing on the server as "lost data" — so it restores the old scores locally and even pushes them back to the database.

Fix: when games are changed (or a round is reset), wipe the device copy at the same moment instead of merging against it.

## Issue 2 — A queued score can be thrown away

Queued scores are dropped when the database says "no" — that is correct for a bad value, but the database also says "no" while a round created offline has not been created on the server yet. Those scores get discarded permanently.

Fix: only discard a queued score when the round exists and the rejection is genuinely permanent; otherwise keep retrying, and stop retrying only after the 7-day expiry already in place.

## Technical notes

- `src/App.tsx`: in the active-round caching effect, skip gap-filling when the round's scores were intentionally replaced (flag set by `changeGames`); clear the cached round in `changeGames` before the next cache write.
- `src/App.tsx` `syncPendingChanges`: on `wasUpdated === false`, verify the round row exists and is owned by the user before treating it as permanently rejected; otherwise `incrementSyncRetry`.
- `src/hooks/useRounds.tsx` `hydrateFromCache`: unchanged behaviour, but it will no longer see a stale cache after a games change.
