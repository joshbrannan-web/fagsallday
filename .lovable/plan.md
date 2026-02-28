

## Fix Rounding & Formatting Bugs in Green Fee Split + Settlement

### Bug 1: Settlement amounts show unformatted floats
**File**: `src/components/RoundSummary.tsx` (line 316)

`$${t.amount}` → `$${t.amount.toFixed(2)}`

This prevents outputs like `$66.66666666666667`.

### Bug 2: `formatMoney` doesn't round to 2 decimal places
**File**: `src/services/gameEngine.ts` (line 1891)

Change `Math.abs(amount)` to `Math.abs(amount).toFixed(2)` but strip trailing `.00` for clean whole-dollar display. E.g., `+$45` stays clean, `+$66.67` shows correctly.

Updated logic:
```
const abs = Math.abs(amount);
const formatted = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
return `${prefix}$${formatted}`;
```

### Bug 3: Penny drift in green fee payer credit
**File**: `src/components/GreenFeeSplitDialog.tsx` (line 60)

Change `adjustments[payerId] = perPerson * selectedPlayerIds.size` to compute the payer credit as `amount - perPerson` (total paid minus their own share). This ensures the sum of all adjustments is exactly zero regardless of rounding.

### Files modified
- `src/components/RoundSummary.tsx`
- `src/services/gameEngine.ts`
- `src/components/GreenFeeSplitDialog.tsx`

