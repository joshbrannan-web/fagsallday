

## Plan: Update Games Breakdown Sharing Format

### Current Format
```text
--- Games Breakdown ---
Banker ($5/unit):
  John: +$45 | Mike: +$20 | Sarah: -$25 | Dave: -$40
```

### Desired Format
```text
--- Games Breakdown ---
Banker ($5/unit):
  John: +$45
  Mike: +$20
  Sarah: -$25
  Dave: -$40
```

---

### Implementation

**File:** `src/components/RoundSummary.tsx`

**Change:** Lines 200-204

Update the `handleShare` function to format each player on their own line instead of a pipe-separated single line.

**Before:**
```tsx
const playerLine = sortedPlayers
  .map(p => `${p.name}: ${formatMoney(gameResult.playerResults[p.id] || 0)}`)
  .join(' | ');

gameBreakdown += `\n${game.name} ($${game.unitStake}/unit):\n  ${playerLine}`;
```

**After:**
```tsx
const playerLines = sortedPlayers
  .map(p => `  ${p.name}: ${formatMoney(gameResult.playerResults[p.id] || 0)}`)
  .join('\n');

gameBreakdown += `\n${game.name} ($${game.unitStake}/unit):\n${playerLines}`;
```

---

### Result

The shared text will now display as:

```text
🏌️ Pebble Beach Golf Links - Jan 27, 2026

John: +$85 (76 strokes)
Mike: +$15 (80 strokes)
Sarah: -$40 (84 strokes)
Dave: -$60 (88 strokes)

Money Shot by F&Gs All Day

--- Games Breakdown ---
Banker ($5/unit):
  John: +$45
  Mike: +$20
  Sarah: -$25
  Dave: -$40
6's or 3's ($10/unit):
  John: +$20
  Mike: -$10
  Sarah: +$10
  Dave: -$20
```

---

### Summary

| File | Lines | Change |
|------|-------|--------|
| `src/components/RoundSummary.tsx` | 200-204 | Change `.join(' \| ')` to `.join('\n')` and add indentation prefix to each player line |

