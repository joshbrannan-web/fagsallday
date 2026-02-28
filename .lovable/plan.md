

## Bugs & Gaps Found in Share Text Generation

### Bug 1: Header shows green-fee-merged amounts (misleading)

**File**: `src/components/RoundSummary.tsx`, lines 272-279

The top-line player results in the share text use `finalAmounts` (game P&L + green fee adjustments). This means if Brandon won +$45 in games but paid the green fee, the header would show +$195 — making it look like he won $195 in games. The header should reflect **game-only** P&L. Green fees belong in their own section.

**Fix**: Use `displayAmounts` (game-only) for the header results line, keep `finalAmounts` only for the settlement calculation.

```typescript
// Line 277-278: change finalAmounts → displayAmounts
const results = sortedPlayers.map((p) => 
  `${p.name}: ${formatMoney(displayAmounts[p.id] || 0)} (${getPlayerTotalScore(p.id)} strokes)`
).join('\n');
```

---

### Bug 2: Penny drift in green fee split for non-even divisions

**File**: `src/components/GreenFeeSplitDialog.tsx`, line 60

When the total doesn't divide evenly (e.g. $200 / 3 = $66.67), each selected player is charged `$66.67` but the payer is credited `$200 - $66.67 = $133.33`. Two others pay $133.34 total. The net is off by $0.01, which flows into the settlement and can produce a phantom micro-transaction.

**Fix**: Calculate the payer's credit as the sum of what others owe, not `amount - perPerson`:

```typescript
// Line 60
adjustments[payerId] = perPerson * selectedPlayerIds.size;
```

---

### Bug 3: Share text `perPerson` not rounded consistently with dialog

**File**: `src/components/RoundSummary.tsx`, line 304

The dialog rounds `perPerson` to the nearest cent with `Math.round(... * 100) / 100`, but the share text computes it as a raw division: `greenFee.totalAmount / greenFee.splitCount`. For $200 / 3, the dialog shows $66.67 but the share text would show $66.67 only by luck of `.toFixed(2)` — the underlying value is 66.666... which could cause display inconsistencies.

**Fix**: Apply the same rounding:

```typescript
const perPerson = (Math.round((greenFee.totalAmount / greenFee.splitCount) * 100) / 100).toFixed(2);
```

---

### Bug 4: Games breakdown skipped for single-game rounds

**File**: `src/components/RoundSummary.tsx`, line 282

The condition `if (currentRound.games.length > 1)` means single-game rounds never show a games breakdown. This is a minor gap — a single game's name and stake are still useful context in the share text.

**Fix**: Change to `>= 1`:

```typescript
if (currentRound.games.length >= 1) {
```

---

### Summary of files to modify
- `src/components/RoundSummary.tsx` — 3 fixes (lines 278, 282, 304)
- `src/components/GreenFeeSplitDialog.tsx` — 1 fix (line 60)

