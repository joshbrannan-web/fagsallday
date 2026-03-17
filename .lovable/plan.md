

# Replace Three Functions in `src/App.tsx` with Atomic RPC Versions

The current `updateScore`, `updateGameData`, and `updateGameDataBatch` (lines 340–408) still call `updateRound()` (full-blob write) as the primary write path, with the RPC as a secondary call. This means the race condition is NOT actually fixed yet — the full-blob write still happens first.

## Change

Replace lines 340–408 in `src/App.tsx` with the user-provided versions that:

1. **`updateScore`**: Sets local state via `setLocalCurrentRound`, then calls `supabase.rpc('patch_round_scores')` as the sole DB write. Falls back to `updateRound` only on RPC error.

2. **`updateGameData`**: Same pattern — local state first, then `supabase.rpc('patch_round_game_data')` with single key-value. Fallback to `updateRound` on error.

3. **`updateGameDataBatch`**: Same pattern — local state first, then `supabase.rpc('patch_round_game_data')` with full updates object. Fallback to `updateRound` on error.

Key difference from current code: `updateRound()` is no longer called in the happy path — only as a catch fallback. The RPC is now the primary write, eliminating the race condition.

**1 file changed**: `src/App.tsx` (lines 340–408 replaced)
**No other files touched** per the user's constraints.

