# Stop losing locally-cached holes on reload

Scores entered while the database write was failing live only in the offline cache. Today the server round is treated as the sole source of truth on load, so those holes disappear from the UI — and the thinner server copy is then written back over the richer cache, destroying the last copy. This change merges in both directions, additively, and re-queues anything the server is missing.

Rule for every merge: the server value wins for any cell present on both sides. Merging can only fill gaps — never change or delete a score.

## 1. `src/lib/mergeRoundData.ts`

Keep `mergeScores`, `mergeGameData`, and `countScoredHoles` exactly as they are. Add two gap-filling helpers:

- `fillScoreGaps(primary, secondary)` — copies holes/players from the local cache into the server blob only where the server has nothing.
- `fillGameDataGaps(primary, secondary)` — same idea per game bucket (bets, dots, presses, meta), one level deep, primary wins on every conflicting key.

## 2. `src/hooks/useRounds.tsx`

- Import the two new helpers.
- Add a module-scope `hydrateFromCache(round)` that runs only for the user's own ACTIVE rounds and only when the cached round id matches. It:
  - walks the cached scores, and for every valid cell (hole 1-18, score 1-99) the server is missing, pushes a `scorePatch` item onto the offline sync queue so it actually gets persisted (the queue already dedupes per round/hole/player, so it is safe on every fetch), logging a warning with the re-queued count;
  - returns the round with `scores` and `gameData` gap-filled from the cache.
- In `fetchRounds`, wrap own rounds: `hydrateFromCache(dbRoundToRound(...))`.
- Change the `fetchRounds` useCallback dependency from `[user]` to `[user?.id]` so hourly token refreshes stop refetching and replacing the round mid-play (with an eslint-disable line if needed).

## 3. `src/App.tsx` — keep the cache a superset

Replace the active-round caching effect: when a cache already exists for the same round, store the current round with `scores`/`gameData` gap-filled from that cache, so a thinner snapshot can never overwrite richer local data. Otherwise cache as before.

## 4. `src/App.tsx` — RoundRecovery no longer discards on an unverifiable check

Both the initial recovery effect and `handleResume` probe whether the round still exists but ignore the error, so a dropped network request looks identical to "round deleted" and wipes the cache. Capture `error` on both `maybeSingle()` calls: on error, log a warning and resume from the cached round; only clear the cache when the query succeeds and returns no row.

## Out of scope

No changes to `updateScore`'s RPC calls, `patch_round_scores` / `patch_round_game_data`, score entry in `ActiveRound`, and no database migration.
