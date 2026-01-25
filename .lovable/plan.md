

## Plan: Fix 6's/3's Press Storage for Mode-Aware Stretch Attribution

### Problem
The `handleSixesPress` function in `ActiveRound.tsx` (lines 369-370) is:
1. Calling `getSixesStretchForHole(activeHole)` **without the mode parameter** (defaults to 'sixes')
2. Using a **hardcoded formula** `(stretch - 1) * 6 + 1` for `stretchStartHole`

This causes presses in 3's mode to be stored under the wrong stretch metadata.

### Example Bug
- Playing 3's mode, pressing on Hole 6
- Hole 6 in 3's = Stretch 2 (Holes 4-6)
- Current code returns Stretch 1 (6's logic) and stores at hole 1
- Press appears under "Stretch 1" instead of "Stretch 2"

---

### Solution

Update lines 369-370 to:
1. First retrieve the mode from Stretch 1 metadata using `getSixesMode()`
2. Pass the mode to `getSixesStretchForHole()`
3. Use `getStretchStartHole()` instead of the hardcoded formula

Both functions are already imported on line 14.

---

### Code Changes

**File:** `src/components/ActiveRound.tsx`

**Lines 369-370** - Replace:
```tsx
const stretch = getSixesStretchForHole(activeHole);
const stretchStartHole = (stretch - 1) * 6 + 1;
```

**With:**
```tsx
// Get mode from Stretch 1 metadata (where it's always stored)
const mode = getSixesMode(currentRound.gameData, gameId);
const stretch = getSixesStretchForHole(activeHole, mode);
const stretchStartHole = getStretchStartHole(stretch, mode);
```

---

### Backward Compatibility

This fix is **fully backward compatible** with 6's mode:

| Mode | Hole 7 Example |
|------|----------------|
| 6's | `getSixesStretchForHole(7, 'sixes')` returns 2, `getStretchStartHole(2, 'sixes')` returns 7 |
| 3's | `getSixesStretchForHole(7, 'threes')` returns 3, `getStretchStartHole(3, 'threes')` returns 7 |

The engine functions correctly handle both modes.

---

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/ActiveRound.tsx` | 369-370 | Use mode-aware `getSixesStretchForHole()` and `getStretchStartHole()` |

