

# Fix: Realtime feedback loop in Tournament Overlay

## Problem
When leaving the Tournament "My Game" page and returning, the `useTournamentOverlay` hook enters an infinite loop:

1. Realtime subscription fires → calls `reload()`
2. `reload()` fetches scores, runs the engine, then **upserts computed results** back to `tournament_hole_results` (lines 148-165)
3. That upsert triggers the realtime listener on `tournament_hole_results` → calls `reload()` again
4. Loop repeats endlessly

On first load this doesn't happen because the initial `load()` function runs (not `reload`), and `previousHoleCount` is set correctly. On re-mount, the realtime subscription re-establishes and any pending event kicks off the cycle.

## Root Cause
The realtime subscription listens to **both** `tournament_hole_scores` and `tournament_hole_results`. But `reload()` itself **writes** to `tournament_hole_results`, creating a self-triggering loop. The upsert always updates `updated_at`, so Postgres always emits a change event even when the data is identical.

## Fix
**File:** `src/hooks/useTournamentOverlay.ts` — lines 354-357

**Remove the `tournament_hole_results` listener** from the realtime subscription. It's unnecessary because:
- `reload()` already recomputes results from scores via the engine
- Score changes (from any client) are captured by the `tournament_hole_scores` listener
- Admin overrides go through `tournament_hole_scores` first, which triggers `reload()` anyway

This eliminates the feedback loop entirely.

### Changes
- Lines 354-357: Remove the `.on('postgres_changes', ...)` block for `tournament_hole_results`

One file, ~4 lines removed.

