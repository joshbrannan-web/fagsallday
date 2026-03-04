
# Plan: Fix Tournament Round Not Loading After Setup

## Root Cause

When a player completes the tournament round setup wizard and clicks "Start Round", the `startRound` function in `useTournamentRoundSetup.ts` creates the round directly via `supabase.from('rounds').insert(...)`, then navigates to `/active`. However, the `ActiveRound` component gets `currentRound` from the `AppContext` → `useRounds` hook, which maintains its own internal state. Since `useRounds` never learns about the newly inserted round (no refetch is triggered, and `fetchRounds` only re-runs when `user` changes), `currentRound` remains `null`, and the user sees "No Active Round."

This works for the tournament creator only if they happen to have a timing coincidence or if some other state change triggers a refetch. For a second player, it consistently fails.

## Fix

Two changes:

### 1. Expose `refetch` from `useRounds` through `AppContext`

Add `refetchRounds` to the `AppState` interface in `src/contexts/AppContext.tsx` and wire it up in `src/App.tsx` from the `useRounds` hook's existing `refetch` return value.

**`src/contexts/AppContext.tsx`**: Add `refetchRounds: () => Promise<void>` to the `AppState` interface and provide a no-op default.

**`src/App.tsx`**: Pass `refetch` from `useRounds()` (already returned as `refetch: fetchRounds`) into the `AppContext.Provider` value as `refetchRounds`.

### 2. Call `refetchRounds` before navigating in `startRound`

**`src/hooks/useTournamentRoundSetup.ts`**: 
- Import `useApp` from `AppContext`
- After all DB inserts are complete (round, group, group_players, game_data update), call `await refetchRounds()` 
- This ensures `useRounds` picks up the new ACTIVE round and sets `currentRound` before the navigation to `/active` happens
- Then navigate as before

### 3. Add a fallback in `ActiveRound` for race conditions

**`src/components/ActiveRound.tsx`** (lines 343-365): When `currentRound` is null, `isLoading` is false, AND `location.state?.tournamentGroupId` exists, show the loading spinner and trigger a refetch instead of immediately showing "No Active Round." This handles edge cases where the refetch hasn't completed before navigation.

- Add a `useEffect` that detects this state (no currentRound, not loading, but has tournament state) and calls `refetchRounds()` with a short timeout fallback.

## Files Modified

| File | Change |
|------|--------|
| `src/contexts/AppContext.tsx` | Add `refetchRounds` to `AppState` interface |
| `src/App.tsx` | Wire `refetch` into context value |
| `src/hooks/useTournamentRoundSetup.ts` | Import `useApp`, call `refetchRounds()` before navigating |
| `src/components/ActiveRound.tsx` | Add fallback: if tournament state exists but no round, show loader and trigger refetch |

0 new files, 0 database changes.
