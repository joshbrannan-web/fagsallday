

## Plan: Update Handicap Display to Multi-Line Format

### Problem
The current hole header displays the handicap info as `{par}/idx {handicapIndex}` on a single line. The user wants a multi-line format with clearer labels:
```
1
par 4
IDX 9
```

---

### Solution
Update the hole header cell to display three separate lines with proper formatting and labels.

---

### Technical Changes

**File:** `src/components/Scorecard.tsx`

**Current code (line 458-461):**
```tsx
>
  {h.number}
  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}/idx {h.handicapIndex}</div>
</th>
```

**Updated code:**
```tsx
>
  {h.number}
  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">par {h.par}</div>
  <div className="text-[10px] text-muted-foreground font-normal">IDX {h.handicapIndex}</div>
</th>
```

---

### Visual Result

**Before:**
```
1
4/idx 9
```

**After:**
```
1
Par 4
IDX 9
```

---

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/components/Scorecard.tsx` | 460 | Split into two separate divs with "par X" and "IDX Y" format |

