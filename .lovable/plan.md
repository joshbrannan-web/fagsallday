

# Fix Tournament Score Race Condition with Atomic RPC Calls

## Problem
`updateScore`, `updateGameData`, and `updateGameDataBatch` in `App.tsx` read the full `scores`/`game_data` JSON blob from local state, mutate it client-side, then write the entire blob back via `useRounds.updateRound`. With 4-8 groups writing simultaneously to the same round, last-write-wins causes silent data loss.

## Solution
Two PostgreSQL RPC functions (`patch_round_scores`, `patch_round_game_data`) that use `jsonb_set` to atomically update only the changed JSON path. Then wire `App.tsx` to call these RPCs directly for score/gameData changes instead of the full-blob `updateRound`.

## Step 1 — Database Migrations

**Migration 1: `patch_round_scores`**
- Creates a `SECURITY DEFINER` function that uses `jsonb_set` to set `scores -> hole -> playerId` to the new score value
- Single atomic UPDATE, no read-modify-write

**Migration 2: `patch_round_game_data`**  
- Creates a `SECURITY DEFINER` function that reads the current hole-level data, merges the updates via `||`, and writes back with `jsonb_set`
- Handles missing intermediate keys by defaulting to `'{}'::jsonb`

Both functions as specified in the user's request.

## Step 2 — Wire `App.tsx` to Use RPCs

Replace the three mutation functions to call RPCs when authenticated:

**`updateScore` (line 340-349)**
- Keep optimistic local state update (unchanged)
- Replace `await updateRound(currentRound.id, { scores: newScores })` with `await supabase.rpc('patch_round_scores', { p_round_id, p_hole, p_player_id, p_score })`
- On RPC failure, fall back to offline queue

**`updateGameData` (line 352-363)**
- Keep optimistic local state update
- Replace `await updateRound(...)` with `await supabase.rpc('patch_round_game_data', { p_round_id, p_game_id, p_hole, p_updates: { [key]: value } })`

**`updateGameDataBatch` (line 365-376)**
- Keep optimistic local state update
- Replace `await updateRound(...)` with `await supabase.rpc('patch_round_game_data', { p_round_id, p_game_id, p_hole, p_updates: updates })`

## Step 3 — Offline Fallback

In `useRounds.tsx`, the existing `queueUpdatesForSync` and offline cache remain unchanged — they're the fallback when RPC calls fail or the device is offline. The optimistic local update in `App.tsx` ensures the UI stays responsive regardless.

## Files Changed
1. **2 database migrations** — create `patch_round_scores` and `patch_round_game_data` functions
2. **`src/App.tsx`** — replace 3 function bodies (~30 lines changed)

No new files. No schema changes. No RLS changes needed (SECURITY DEFINER bypasses RLS).

