

## Plan: Simplify Hole Header Display

### Overview
Update the hole header cells to show a minimal format with just the hole number and combined par/handicap values.

---

### Requested Display

```
1
4/12
```

---

### Technical Change

**File:** `src/components/Scorecard.tsx` (lines 447-456)

**Current code:**
```tsx
{activeHoles.map(h => (
  <th 
    key={h.number} 
    className="p-2 min-w-[40px] border-r border-border/50 cursor-pointer hover:bg-primary/10 transition-colors"
    onClick={() => navigate('/active', { state: { startHole: h.number } })}
  >
    {h.number}
    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}</div>
  </th>
))}
```

**Updated code:**
```tsx
{activeHoles.map(h => (
  <th 
    key={h.number} 
    className="p-2 min-w-[40px] border-r border-border/50 cursor-pointer hover:bg-primary/10 transition-colors"
    onClick={() => navigate('/active', { state: { startHole: h.number } })}
  >
    {h.number}
    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}/{h.handicapIndex}</div>
  </th>
))}
```

---

### Visual Result

| Before | After |
|--------|-------|
| **1** | **1** |
| 4 | 4/12 |

---

### Files to Change

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Update par display to include handicap index: `{h.par}/{h.handicapIndex}` |

