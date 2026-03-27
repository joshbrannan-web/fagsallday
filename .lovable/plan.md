

# Remaining Sync Gaps and Recommended Fixes

## Gaps Found

### 1. Realtime subscription still active in `useTournamentOverlay.ts` (lines 331-354)
The plan said to **remove** the realtime subscription during play, but it's still there. The `overlay-${tournamentGroupId}` channel listens for `tournament_hole_scores` and `tournament_hole_results` changes and triggers `reload()`, which re-fetches all scores from the DB. During play, this can **overwrite local scores** with stale DB data if another group member's per-hole sync fires. This is the most critical remaining gap — it can cause score loss mid-round.

### 2. Per-hole sync in `ActiveRound.tsx` still fires during play (lines 415-426)
`handleNextHole` calls `batchSyncHole()` on every hole advancement. This contradicts the "defer all writes to round completion" design. These writes during play are the exact pattern that caused the original sync storm. If connectivity is spotty, they'll fail silently and create orphaned partial data in the DB that conflicts with the full batch sync on completion.

### 3. `batchSyncAllScores` doesn't check for admin overrides (lines 549-620)
Unlike `batchSyncHole` (which checks `is_super_user_override`), `batchSyncAllScores` blindly upserts all scores with `is_super_user_override: false`. If an admin corrected a score during the round, the batch sync on completion will **overwrite the admin's correction**.

### 4. Race condition in `handleFinish` — `syncScore` then `batchSyncAllScores` (lines 337-350)
`handleFinish` calls `syncScore` in a loop (which updates React state), waits 200ms, then calls `batchSyncAllScores`. But React state updates are batched and may not have flushed in 200ms. The `allHoleScores` ref inside `batchSyncAllScores` could be stale, causing incomplete score uploads.

### 5. Scoreboard subscriptions depend on `groups` state (line 335)
`useTournamentScoreboards` recreates all realtime channels every time `groups` changes. If `groups` reference changes on re-render (object identity), this causes channel churn — unsubscribing and resubscribing rapidly. This is mitigated by the per-group filter but still wasteful.

### 6. No verification that batch sync actually persisted all rows
`batchSyncAllScores` checks for Supabase errors but doesn't verify row count. An RLS-blocked upsert returns empty data (not an error). If a non-creator hits an edge case where `is_group_member` returns false (e.g., group_players record was deleted mid-round), the sync silently fails.

## Recommended Fixes

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | **Remove the realtime subscription** from `useTournamentOverlay.ts` entirely (lines 331-354). It serves no purpose during deferred-sync play and risks overwriting local state. | `useTournamentOverlay.ts` | Small |
| 2 | **Remove per-hole `batchSyncHole` calls** from `handleNextHole` in `ActiveRound.tsx` (lines 415-426). All writes should happen only in `batchSyncAllScores` on completion. | `ActiveRound.tsx` | Small |
| 3 | **Add admin override check to `batchSyncAllScores`** — before upserting, query `tournament_hole_scores` for `is_super_user_override = true` rows and exclude those player/hole combos from the payload. | `useTournamentOverlay.ts` | Small |
| 4 | **Fix the race condition in `handleFinish`** — instead of calling `syncScore` + 200ms delay, pass `currentRound.scores` directly to `batchSyncAllScores` as a parameter, so it doesn't depend on React state timing. | `useTournamentOverlay.ts`, `RoundSummary.tsx` | Medium |
| 5 | **Add row-count verification after batch upsert** — compare upserted count vs expected count; if mismatch, warn and retry. | `useTournamentOverlay.ts` | Small |
| 6 | **Remove `batchSyncHole` and related dirty-hole tracking** (`syncedHolesRef`, `dirtyHolesRef`, `getDirtyHoles`, `markHoleDirty`) since they're no longer needed with pure end-of-round sync. | `useTournamentOverlay.ts` | Small |

## Summary of Changes

```text
useTournamentOverlay.ts:
  - Delete realtime subscription (lines 331-354)
  - Delete batchSyncHole + dirty-hole refs
  - Add admin override check to batchSyncAllScores
  - Accept optional scores parameter in batchSyncAllScores
  - Add row-count verification after upserts

ActiveRound.tsx:
  - Remove batchSyncHole calls from handleNextHole (lines 415-426)

RoundSummary.tsx:
  - Pass currentRound.scores directly to batchSyncAllScores
  - Remove the syncScore loop + 200ms delay hack
```

3 files changed, 0 database changes. All changes are removals or hardening of existing code.

