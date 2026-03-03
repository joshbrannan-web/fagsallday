

# Fix Audit Items #28, #46, #67, #68

## Item #28 — Scoreboard reordering

**Problem:** ScoreboardManager has no drag-to-reorder or manual reorder UI. Scoreboards get auto-assigned `display_order` on creation but cannot be rearranged.

**Fix:** Add up/down arrow buttons to each scoreboard card in `ScoreboardManager.tsx`. Clicking moves the scoreboard one position and calls `onUpdate` for both swapped items. Add an `onReorder` prop (or reuse `onUpdate`) to persist the new `display_order` values.

**Files:**
- `src/components/tournament-admin/ScoreboardManager.tsx` — add ChevronUp/ChevronDown buttons to each card, implement swap logic that calls `onUpdate` for both affected scoreboards with their new `display_order` values

## Items #46, #67, #68 — Wire GameSelector into both SetupWizard and TournamentBuildRoundWizard

**Problem:** `GameSelector.tsx` exists (570 lines, full config UI for all 11 game types including FBO matchups, handicap modes, Wolf tee order, multipliers) but is imported by nothing. Both `SetupWizard.tsx` and `TournamentBuildRoundWizard.tsx` Step 6 have their own inline implementations with varying levels of completeness.

**Fix — SetupWizard (item #67):**
Replace the inline game selection block in `SetupWizard.tsx` (the `GAME_LIBRARY.map(...)` block in step 3, ~lines 1725-2400+) with:
```tsx
<GameSelector
  players={players}
  selectedGames={selectedGames}
  onGamesChange={setSelectedGames}
/>
```
Remove the now-unused inline `handleToggleGame`, `handleUpdateGameStake`, `handleUpdateGameConfig`, `updateGameConfigDeep` functions (keep other SetupWizard logic intact).

**Fix — TournamentBuildRoundWizard Step 6 (item #46):**
Replace `renderStep6()` body (lines 223-307) with GameSelector. The tournament wizard's players are in a different format (`TournamentPlayer[]` with `display_name` vs `Player[]` with `name`), so map them to the `Player` shape before passing:
```tsx
const mappedPlayers: Player[] = setup.selectedPlayers.map(p => ({
  id: p.id,
  name: p.display_name,
  handicapIndex: p.handicap_index ?? undefined,
}));

return (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Add Side Games?</h2>
    <p className="text-sm text-muted-foreground">
      Optional — add betting games alongside the tournament.
    </p>
    <GameSelector
      players={mappedPlayers}
      selectedGames={sideGames}
      onGamesChange={setup.setSideGames}
    />
  </div>
);
```
Remove the inline `toggleGame`, `updateStake` functions from renderStep6.

**Item #68** is resolved automatically — GameSelector will have two importers after these changes.

**Files:**
- `src/components/SetupWizard.tsx` — replace inline game selection with `<GameSelector>`, remove duplicate handler functions
- `src/components/tournament/TournamentBuildRoundWizard.tsx` — replace `renderStep6` body with `<GameSelector>`, add player mapping

