

## Fix: Add Course Par Under "Total" in Share Image Scorecard

### Problem
The hidden scorecard capture container (used for the Share Image feature) shows "Total" in the header but does not display the course par underneath it. The on-screen scorecard already shows par totals under its F9/B9 and 18 columns, but the image capture container was not updated to match.

### Fix

**File: `src/components/Scorecard.tsx`** (lines 1348-1356)

Add a par total line under the "Total" text in the hidden capture container's header row, matching the style of the per-hole par labels:

```typescript
<th style={{ 
  padding: '8px', 
  minWidth: '50px', 
  backgroundColor: '#f5f3ef',
  fontSize: '12px',
  fontWeight: 700,
  color: '#737a85',
  textTransform: 'uppercase'
}}>
  Total
  <div style={{ fontSize: '10px', color: '#737a85', fontWeight: 400, marginTop: '2px' }}>
    par {currentRound.course.holes.reduce((sum, h) => sum + h.par, 0)}
  </div>
</th>
```

This adds a single `<div>` element showing "par 72" (or whatever the course total par is) directly under the "Total" label, using the same inline style as the per-hole par labels.

### Files Changed

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Add par total display under "Total" header in the hidden image capture container (1 line addition) |

