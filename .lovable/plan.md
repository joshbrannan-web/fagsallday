# Hammer: Concede the Hole

Add a "Concede" action for each team in the Hammer status bar. When a team concedes, the **original base bet** (the unit stake at the start of the hole) is awarded to the other team — no hammer doublings, no birdie/eagle multipliers, no 2nd-ball tiebreaker logic.

## Behavior

- Two new buttons appear under the existing "A throws" / "B throws" buttons:
  - "Team A concedes" → Team B wins the base bet
  - "Team B concedes" → Team A wins the base bet
- A confirmation dialog (`AlertDialog`) appears before applying ("Concede this hole? Team X wins $unitStake. No multipliers apply.") to prevent misclicks.
- Once conceded, both throw and concede buttons disable, the status bar shows "Conceded by Team X — Team Y wins $base", and the hole's payout is locked at base unit stake.
- Conceding works at any point in the hole (before or after scores entered). Scores entered for the hole are ignored for payout purposes when a concession exists.
- In LR Hammer 2v1 mode, the solo side conceding pays each pair member the base; the pair conceding has each member pay the solo the base (mirrors existing 2v1 payout shape but at base, not multiplied pot).

## Technical Details

### Data model (`src/types.ts`)
Add to `HammerHoleState`:
```ts
concededBy?: 'A' | 'B' | null; // team that conceded → opponent wins basePot
```
Stored at `gameData[gameId][hole].concededBy`.

### Engine (`src/services/hammerEngine.ts`)
- Extend `getHammerHoleState` to also return `concededBy`.
- In `calculateHammerHole`:
  - After loading teams (and before requiring scores), check `concededBy`. If set:
    - `winningTeam` = opposite side
    - `potBeforeMultipliers` = `potAfterMultipliers` = `basePot` (ignore `hammerCount`, ignore birdie/eagle multipliers)
    - `lowBallPlayerIds = []`
    - Skip the "all scored" requirement (concession resolves the hole regardless of scores).
    - Populate `isSolo`/`soloPlayerId`/`pairPlayerIds` as today so 2v1 payouts work.
- `calculateHammerHolePayouts` works unchanged because it reads `potAfterMultipliers` from the result.
- In `calculateHammer` aggregator, add a detail line like: `Hole H: Conceded by Team X — Team Y wins $base`.

### UI (`src/components/hammer/HammerStatusBar.tsx`)
- Read `concededBy` via `getHammerHoleState`.
- Under the existing throw button row, render a second row with two outline buttons:
  - "Team A concedes" / "Team B concedes" (smaller, muted styling).
- Each opens an `AlertDialog` confirm; on confirm:
  ```ts
  onUpdateGameData(game.id, activeHole, { concededBy: side });
  ```
- When `concededBy` is set:
  - Disable both throw buttons and both concede buttons.
  - Replace the "X hammers thrown" line (or render alongside) with: `Team X conceded — Team Y wins $${basePot}`.
- Read-only mode hides concede buttons (same gate as throw buttons).

### Notes / out-of-scope
- No "undo concede" affordance is added in this pass. (Can be added later if requested; it would just clear `concededBy`.)
- Tournament/admin scorecard views read the same engine, so concession results flow through automatically.

## Files to Edit
- `src/types.ts` — add `concededBy` field to `HammerHoleState`.
- `src/services/hammerEngine.ts` — return + honor `concededBy`; short-circuit calculation; aggregator detail line.
- `src/components/hammer/HammerStatusBar.tsx` — concede buttons, confirm dialog, conceded status display, disabled state.
