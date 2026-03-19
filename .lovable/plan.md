

# Fix Non-Owner Tournament Round Experience

## Issues
1. **Button text**: Shared tournament round button says "Resume Tournament Round" — should say "View Tournament Round"
2. **Scorecard footer**: Non-owner sees only "Return to Home" — should also see "Return to Hole" button (like owner)
3. **Tournament tab empty**: When non-owner Clark clicks Tournament tab, no data loads

## Root Cause Analysis

### Issue 3 (Tournament tab empty for non-owner)
The `useTournamentOverlay` hook queries tournament tables (`tournament_groups`, `tournament_rounds`, `tournament_teams`, etc.) which all have RLS requiring `is_tournament_member(tournament_id)`. If the non-owner (Clark) was added as a `round_participant` but never joined the tournament via `tournament_members`, all queries return empty/null and the overlay shows nothing.

Additionally, the `reload()` function in `useTournamentOverlay` tries to **upsert** to `tournament_hole_results` (line 162-167) even for read-only users, which would fail silently. The reload should skip this write for non-owners.

**Fix**: The overlay data loading itself should work if the user is a tournament member. Need to verify Clark's membership and potentially add a guard so the upsert is skipped for read-only views. If membership is the issue, the round-sharing flow should auto-add the participant as a tournament member.

## Changes

### 1. `src/components/Landing.tsx` (line 256)
Change "Resume Tournament Round" to "View Tournament Round" for the shared round button (the `sharedActiveRound` with `sharedMeta` block).

### 2. `src/components/Scorecard.tsx` (lines 1363-1368)
Update the `isReadOnly` footer to include a "Return to Hole" button alongside "Return to Home" — same as the owner's footer but without "Share Image". The button navigates back to `/active` with the tournament state.

### 3. `src/hooks/useTournamentOverlay.ts` (lines 150-167)
Guard the `tournament_hole_results` upsert in the `reload()` function so it only runs when the user is the round owner (not read-only). Accept an optional `isReadOnly` parameter and skip the write when true.

### 4. `src/components/ActiveRound.tsx` (line 52-58)
Pass `isReadOnly` to `useTournamentOverlay` so it knows to skip writes.

## Technical Details

**Landing.tsx change** — single text change on line 256.

**Scorecard.tsx change** — replace the read-only footer block (lines 1363-1368) to include both "Return to Home" and "Return to Hole" buttons side by side, with Return to Hole navigating to `/active` with tournament state from `_TOURNAMENT_META`.

**useTournamentOverlay.ts change** — add `isReadOnly?: boolean` parameter, wrap the upsert block in `if (!isReadOnly)`.

**ActiveRound.tsx change** — pass `isReadOnly` as 6th argument to `useTournamentOverlay`.

