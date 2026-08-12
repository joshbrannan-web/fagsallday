# Fix live-round score persistence

## Confirmed diagnosis

The current round still has an empty `scores` object in the database, while its hole 2 and hole 3 betting data is present. The four recent score requests for hole 1 returned success, but the database score function uses a nested JSON update without first creating the hole object. PostgreSQL therefore leaves `{}` unchanged when the hole key does not already exist. The betting function explicitly creates its parent object first, which explains why Double/Triple selections persist while scores do not.

## Implementation

1. **Correct the atomic score function**
   - Update `patch_round_scores` to initialize the requested hole object before writing the player's score.
   - Keep each score entry atomic so simultaneous player/device updates cannot overwrite other holes or players.
   - Require the signed-in user to own the round before the function can modify it.

2. **Make score saves fail visibly and recover safely**
   - Have the function report whether a row was actually updated rather than silently returning success.
   - Keep the optimistic local score immediately visible and cached.
   - If the atomic request fails or reports no update, queue the score for retry without replacing the full score object.

3. **Harden offline replay**
   - Store pending score changes as individual round/hole/player patches rather than stale whole-score snapshots.
   - Replay those atomic patches when connectivity returns, preserving scores entered by other sessions.

4. **Add regression coverage and verify the live flow**
   - Test writing the first player score into an empty round, adding the remaining players on that hole, adding later holes, and editing an existing score.
   - Verify betting data and score data both remain after navigating away and reopening the active round.
   - Re-query the current round after a test score to confirm the database contains the expected nested hole/player values.

## Current-round recovery

The missing hole 1–5 scores are not present in the database. Preserve and merge any scores still available in this browser's offline round cache after the fix; scores absent from both the database and device cache will need to be re-entered. Existing betting selections will remain untouched.

## Technical details

The corrected database update will create `scores[hole]` first, then set `scores[hole][player]`. The client retry queue will use the same atomic identity `(round ID, hole number, player ID)` and deduplicate newer edits for that identity.
