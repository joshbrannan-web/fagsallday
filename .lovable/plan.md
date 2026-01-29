

## Plan: Add 18-Hole Total Column to Scorecard

### Request
Add a column showing the total strokes for each player over all 18 holes, positioned next to the current subtotal column (which shows Front 9 or Back 9 depending on view mode).

---

### Current Behavior
- The scorecard shows 9 holes at a time (Front 9 or Back 9)
- A "Total" column displays the subtotal for the current view (9 holes only)
- The `calculateTotalScore` function already exists (lines 462-469) but is only used for the hidden image capture container

### Solution
Add a new "18" column next to the existing subtotal column to show the full round total for each player. This provides at-a-glance visibility into overall performance regardless of which 9 is being viewed.

---

### Implementation Details

**File: `src/components/Scorecard.tsx`**

#### Change 1: Update Table Header (Line 525)

Add a new header column for 18-hole total:

**Before:**
```tsx
<th className="p-2 min-w-[50px] bg-muted">Total</th>
```

**After:**
```tsx
<th className="p-2 min-w-[50px] bg-muted">{viewMode === 'FRONT' ? 'F9' : 'B9'}</th>
<th className="p-2 min-w-[50px] bg-muted border-l border-border">18</th>
```

#### Change 2: Update Score Row Total Cell (Line 569)

Add 18-hole total next to subtotal:

**Before:**
```tsx
<td className="p-2 font-bold">{calculateSubtotalScore(player.id, activeHoles) || '-'}</td>
```

**After:**
```tsx
<td className="p-2 font-bold">{calculateSubtotalScore(player.id, activeHoles) || '-'}</td>
<td className="p-2 font-bold border-l border-border">{calculateTotalScore(player.id) || '-'}</td>
```

#### Change 3: Update P&L Row Total Cell (Lines 583-586)

Add empty cell to maintain column alignment:

**Before:**
```tsx
<td className="px-2 pb-2">
  <span className={`font-mono font-bold ${(roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
    ${roundTotals[player.id] || 0}
  </span>
</td>
```

**After:**
```tsx
<td className="px-2 pb-2">
  <span className={`font-mono font-bold ${(roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
    ${roundTotals[player.id] || 0}
  </span>
</td>
<td className="px-2 pb-2 border-l border-border"></td>
```

#### Change 4: Update Press Row (Stockton 6's) if Present

Add empty cell for column alignment in the press row:

**Before (around line 612):**
```tsx
<td className="p-2">-</td>
```

**After:**
```tsx
<td className="p-2">-</td>
<td className="p-2 border-l border-border">-</td>
```

---

### Also Update AdminScorecard for Consistency

**File: `src/components/AdminScorecard.tsx`**

Apply the same changes to maintain consistency:

1. **Line 305**: Update header to include F9/B9 label and 18-hole column
2. **Line 348**: Add 18-hole total cell after subtotal
3. **Lines 362-366**: Add empty cell after P&L total
4. **Around line 392**: Add empty cell to Press row

Also need to add a `calculateTotalScore` function (same as Scorecard.tsx):
```tsx
const calculateTotalScore = (pid: string) => {
  let total = 0;
  holes.forEach(h => {
    const s = currentRound.scores[h.number]?.[pid];
    if (typeof s === 'number') total += s;
  });
  return total;
};
```

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Add "18" header column; add 18-hole total to score row; add empty cells to P&L and Press rows for alignment |
| `src/components/AdminScorecard.tsx` | Same changes + add `calculateTotalScore` function |

---

### Expected Result

The scorecard will display:

| Player | 1 | 2 | ... | 9 | F9 | 18 |
|--------|---|---|-----|---|-----|------|
| John | 4 | 5 | ... | 4 | 38 | 76 |
| Mike | 5 | 4 | ... | 5 | 40 | 80 |

When viewing Back 9:

| Player | 10 | 11 | ... | 18 | B9 | 18 |
|--------|-----|-----|-----|-----|-----|------|
| John | 4 | 4 | ... | 5 | 38 | 76 |
| Mike | 5 | 5 | ... | 4 | 40 | 80 |

