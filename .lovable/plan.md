

## Green Fee Split on Share

When the user taps "Share" on the Round Summary, show a dialog asking if they want to include a green fee split. If yes, collect who paid, how much, and which players to split against. Fold the result into the settlement calculation.

### Implementation

**1. Create `GreenFeeSplitDialog` component** (`src/components/GreenFeeSplitDialog.tsx`)

- Dialog with steps:
  - Step 1: "Include Green Fee Split?" — Yes / No buttons. No closes dialog and calls `onSkip()` (proceeds with normal share).
  - Step 2: Select the payer from a list of round players (radio/button group).
  - Step 3: Enter total amount paid (number input).
  - Step 4: Select which other players to split against (checkboxes, payer excluded from list, all checked by default).
  - Step 5: Show summary — e.g. "Each player owes Brandon $50" — with Confirm button.
- On confirm, calls `onConfirm(adjustments)` where adjustments is `Record<string, number>` — the per-player green fee debt (positive = owes money to payer, payer gets negative = is owed).
- Calculation: `perPerson = totalAmount / (selectedPlayers.length + 1)`. Each selected player owes `perPerson` to the payer. The payer is owed `perPerson * selectedPlayers.length`.

**2. Update `RoundSummary.tsx`**

- Import `GreenFeeSplitDialog`.
- Add state: `showGreenFeeDialog: boolean` (default false).
- Change `handleShare` button's `onClick` to `() => setShowGreenFeeDialog(true)` instead of calling `handleShare` directly.
- Add `handleGreenFeeConfirm(greenFeeAdjustments: Record<string, number>)`:
  - Merge green fee adjustments into `displayAmounts` to produce `finalAmounts`: for each player, `finalAmounts[id] = (displayAmounts[id] || 0) + greenFeeAdjustments[id]`.
  - Pass `finalAmounts` to the share text generation and `calculateSettlement` (extract current share logic into a helper that accepts amounts).
  - Call the share/clipboard logic with the updated text that includes a "Green Fees" line in the breakdown.
- Add `handleGreenFeeSkip()`: calls existing `handleShare` as-is.
- Render `<GreenFeeSplitDialog>` with `open={showGreenFeeDialog}`, `players={currentRound.players}`, `onSkip`, `onConfirm`, `onClose`.

**3. Share text format update**

When green fee split is included, append a section before the settlement:
```
--- Green Fees ---
  Brandon paid $200 (split 4 ways)
  Each player: $50
```

The settlement section uses the merged amounts (game P&L + green fee debts) so the "Who Pays Who" reflects everything in one set of transactions.

### Files
- `src/components/GreenFeeSplitDialog.tsx` — new
- `src/components/RoundSummary.tsx` — modified

