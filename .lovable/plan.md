

# Optimize Realtime Subscriptions for Tournament Round Sync

## Analysis

**1. `useRounds.tsx` — realtime subscription (lines 153-189)**

Currently the subscription listens to ALL updates on the `rounds` table and then filters client-side with `sharedActiveIds.includes(updated.id)`. This means every round update by any user hits every connected client. Adding a server-side filter will eliminate unnecessary payload delivery.

**2. `AdminRoundContext.tsx` — no subscription at all**

The admin round context does a single fetch on mount and has no realtime subscription. This means the admin live view does NOT auto-update when scores change — it shows a snapshot. This is a separate concern from the `useRounds` optimization but worth adding for admin live monitoring.

## Will this speed up tournament sync?

**Yes, but modestly.** The `useRounds` filter change reduces unnecessary network traffic — instead of receiving every `rounds` table update and discarding irrelevant ones client-side, the database only sends updates for rounds the user is actually in. During a tournament with many active groups, this prevents each client from processing updates meant for other groups.

The bigger win for tournament scoring sync is actually in the `tournament_hole_scores` and `tournament_hole_results` realtime channels (already filtered per-tournament in `useTournamentOverlay` and `useTournamentScoreboards`). The `rounds` table subscription is secondary — it syncs the side-game JSONB blob, not the tournament engine scores.

## Changes

### 1. `src/hooks/useRounds.tsx` — Add server-side filter to realtime subscription
- Add `filter: \`id=in.(${sharedActiveIds.join(',')})\`` to the `.on()` config
- Remove the now-redundant client-side `sharedActiveIds.includes()` check (keep as safety fallback)

### 2. `src/contexts/AdminRoundContext.tsx` — Add realtime subscription for the viewed round
- Subscribe to `postgres_changes` on the `rounds` table filtered to `id=eq.${roundId}`
- On UPDATE, merge the new data into state and recalculate totals
- Clean up channel on unmount
- This enables admins to see live score updates without refreshing

