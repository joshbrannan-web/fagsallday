# Glenmoor round (Aug 6): back nine scores are missing in the database

## What I found

Round `1c78c507` (Glenmoor Golf Course, Josh Brannan + Brandon, Dallin, Kimball), still marked ACTIVE, last written 22:10 UTC today.

- Gross scores stored: holes 1-9 only (all 4 players). Holes 10-18 have no score entries at all.
- Game data stored: holes 1-18 for both games. Team Banker has dot entries through hole 18; FBO has hole records through 18.

So the back nine was definitely played and recorded on a device — the per-hole game data proves it — but the gross score blob in the database was rolled back to a 9-hole snapshot. Only the game data survives; the actual stroke numbers for holes 10-18 are not in the database and cannot be reconstructed from it (Banker dots and FBO records don't contain strokes).

## Why this happens

Scores are saved as one whole-blob overwrite on a 3-second debounce (`useRounds.updateRound` → `flushPendingUpdates` writes the entire `scores` object, last write wins), while game data is written separately. If a second session (another tab, a returning phone, or a queued offline replay) held a stale 9-hole copy of `scores` and flushed after the back nine, it silently clobbered holes 10-18. Game data escaped because it was flushed from the session that had the full picture.

## Recovery path

1. Check the device that entered the back nine (Josh's phone browser) — the offline cache key `fg_offline_round` may still hold the full 18-hole scores. If it does, reopen the round on that device while online and re-enter/flush; otherwise export the cached JSON and I can restore it directly.
2. If no cached copy exists, the back-nine strokes have to be re-entered manually (I can restore them into the round in one write if you send me the numbers).
3. Once scores are back, mark the round complete so it locks.

## Preventing a repeat

Change score persistence from whole-blob overwrite to per-hole atomic patching, mirroring what already exists on the database side:

- Route owner score writes through the existing `patch_round_scores(p_round_id, p_hole, p_player_id, p_score)` function instead of `update(rounds).scores = <whole blob>`.
- Do the same for the offline sync queue drain, so replaying a stale queue can only add holes, never remove them.
- Add a guard on any remaining whole-blob write: refuse to write a `scores` object with fewer recorded holes than the row currently has, and log when that guard trips.

## Technical notes

- Files: `src/hooks/useRounds.tsx` (`flushPendingUpdates`, `updateRound`, `queueUpdatesForSync`), `src/services/offlineStorage.ts` (queue drain).
- Database function `patch_round_scores` already exists and is security definer; no migration needed for the fix.
- No schema changes required.
