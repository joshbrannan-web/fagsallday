

# Fix Plan: 3 FAIL Items + 3 PARTIAL Items

## ❌ #48 — syncScore never called (CRITICAL)

**Problem:** `useTournamentOverlay` exposes `syncScore` but `ActiveRound.tsx` never calls it when scores change.

**Fix:** In `ActiveRound.tsx`, extract tournament state from `location.state`, get `syncScore` from `useTournamentOverlay`, and call it after every `updateScore` call. There are 3 call sites: voice command (~line 405), `handleScoreChange` (~line 425), and `handleScoreClick` (~line 434). Add a wrapper or `useEffect` that watches `currentRound.scores` and syncs changed scores. A `useEffect` approach is cleanest — whenever `currentRound.scores[activeHole]` changes, iterate players and call `syncScore` for each with a score.

Alternatively, create a simple callback `onScoreChange(hole, playerId, score)` that calls `syncScore` alongside `updateScore`. Add it to the 3 existing call sites.

## ❌ #40 — Step 6 Side Games is placeholder

**Problem:** `GAME_LIBRARY` is defined inside `SetupWizard.tsx` (lines 64-175) and not exported.

**Fix:**
1. Extract `GAME_LIBRARY` and `GAME_DETAILS` arrays from `SetupWizard.tsx` into a new shared file `src/lib/gameLibrary.ts` 
2. Import from that file in both `SetupWizard.tsx` and `TournamentBuildRoundWizard.tsx`
3. Replace the Step 6 placeholder in `TournamentBuildRoundWizard.tsx` with a game selection UI: show game cards, allow toggling games on/off, configure stakes — replicating the SetupWizard game step logic. Filter games by player count (use `requiredPlayerCount` from the wizard).

## ❌ #42 — Round name not stored

**Problem:** The `rounds` table has no `name` column and the tournament round insert doesn't store identifying metadata.

**Fix:** Store tournament metadata in the `game_data` JSON field (which already exists as a JSONB column) during round creation in `useTournamentRoundSetup.ts`:
```ts
game_data: {
  _tournament_meta: {
    tournamentName: tournament.name,
    roundName: selectedRound.name || `Round ${selectedRound.round_number}`,
    tournamentGroupId: newGroup.id
  }
}
```
This avoids modifying the `rounds` table schema. Display this name in round history if present.

## ⚠️ #22 — Verify amber Override badge

**Action:** Read `PlayerListAdmin.tsx` to verify styling. If missing, add amber badge.

## ⚠️ #23 — Verify team reassignment

**Action:** Read `TeamListAdmin.tsx` to verify move-player-between-teams logic works.

## ⚠️ #38 — Step 5 team locking

**Current:** Entire component is read-only. **Acceptable as-is** since teams are fixed by Super User. No change needed — this is by design.

## Files to Create
- `src/lib/gameLibrary.ts` — extracted GAME_LIBRARY + GAME_DETAILS

## Files to Modify
- `src/components/SetupWizard.tsx` — import GAME_LIBRARY/GAME_DETAILS from shared file instead of inline
- `src/components/tournament/TournamentBuildRoundWizard.tsx` — replace Step 6 placeholder with real game selection UI
- `src/components/ActiveRound.tsx` — call `syncScore` when scores change (tournament mode)
- `src/hooks/useTournamentRoundSetup.ts` — store tournament metadata in `game_data`

## No database changes needed

