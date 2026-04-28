## Fix LR Hammer team-save & remove throw confirmation

### Bugs

**1. Teams require two saves on Hole 1** (and any hole)

Root cause in `src/App.tsx` `updateGameData` (lines 430-455): it reads `currentRound.gameData` from the closure each call. `HammerStatusBar.saveSetup` writes 3 keys (`lrTeamA`, `lrTeamB`, `lrSolo`) and `ActiveRound` currently fans them out via:
```ts
Object.entries(updates).forEach(([k, v]) => updateGameData(gameId, hole, k, v));
```
All three calls fire in the same render tick using the SAME stale `currentRound`, so each one rewrites `gameData[gameId][hole]` from the original snapshot — only the LAST key survives in state. The user has to save a second time for the merge to land.

**Fix:** Use the existing `updateGameDataBatch` (App.tsx line 457) which merges all keys in a single state update. Wire it into `ActiveRound.tsx` line ~1136 in the Hammer status bar render.

**2. Hammer throw shouldn't require a confirmation dialog**

Currently `handleThrow` opens an `AlertDialog` ("Throw the Hammer? Pot doubles from $X to $Y"). The user wants the throw to register immediately on tap.

**Fix in `src/components/hammer/HammerStatusBar.tsx`:**
- Remove the `throwSide` state, the `<AlertDialog>` for confirmation, and the `confirmThrow` helper.
- In `handleThrow`, directly call `onUpdateGameData` to bump `hammerCount` and set `lastThrownBy`.

### Files

- `src/components/ActiveRound.tsx` — replace per-key `updateGameData` loop with `updateGameDataBatch` for the Hammer card. Confirm `updateGameDataBatch` is imported from `useApp()` (already present per App.tsx context value).
- `src/components/hammer/HammerStatusBar.tsx` — remove the throw confirmation `AlertDialog` and related state; throw fires immediately.

### Out of scope

- Team Hammer segment-start auto-open behavior.
- Any other game's confirm dialogs.
