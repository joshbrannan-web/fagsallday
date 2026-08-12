# Three independent round-data fixes

## 1. Secure the game-data patch function (database migration)

`patch_round_game_data` currently runs as a privileged function with no check on who is calling and no restriction on who may call it, and it updates a round by id alone. A new migration replaces it so that it:

- requires an authenticated caller
- only ever touches rounds owned by that caller
- validates hole range 0–18 (hole 0 stays valid — it carries the Bloody Banker activation metadata) and a non-empty game id
- returns true/false instead of nothing, so the app can tell whether the write actually landed
- has execute permission revoked from public/anon and granted only to authenticated users and server-side code

Then in `src/App.tsx`, both `updateGameData` and `updateGameDataBatch` treat a `false` result as a failure and throw, so the existing catch block falls back to the full-round update. The existing fallback logic is untouched.

## 2. Never submit an invalid score

An invalid score (0) can be submitted when the active hole isn't present in the course setup, and it then sits in the retry queue forever because the database always rejects it.

- `src/components/ActiveRound.tsx`: both `handleScoreChange` and `handleScoreClick` return early with an error toast when the hole is missing from the course; `handleScoreClick` also rejects a non-positive score.
- `src/App.tsx` `updateScore`: rejects any non-integer or out-of-range (below 1, above 99) score before touching state or the queue.

## 3. "Change games" now actually clears the scoreboard

Changing games sends empty scores, but the save path merges against the server copy, so the old scores survive on the server and reappear after a reload.

In `src/hooks/useRounds.tsx`:

- `updateRound` gains `replaceBlobs` and `immediate` options alongside the existing `localOnly`.
- A `replaceBlobsRef` records that the next flush is a replacement.
- The deferred branch clears the debounce timer and either flushes immediately or reschedules the 3s debounce.
- `flushPendingUpdates` reads and resets the flag; when set, it writes the payload as-is and skips the server merge. Normal writes keep the existing merge behaviour unchanged.

In `src/App.tsx`, `changeGames` calls `updateRound(..., { replaceBlobs: true, immediate: true })`.

## Out of scope

`patch_round_scores`, `updateScore`'s RPC call, the sync-queue drain, and all tournament tables/functions stay exactly as they are.
