

## Plan: Adjust Crown Icon Position and Handicap Display Format

### Problem
1. The crown icon is currently positioned at the bottom-right of the score cell (`-bottom-1 -right-1`), but should be at the top-right
2. The handicap display currently shows `{par}/{handicapIndex}` but should show `{par}/idx {handicapIndex}`

---

### Solution
Update the CSS positioning classes for the crown icon and modify the handicap display text format.

---

### Technical Changes

**File:** `src/components/Scorecard.tsx`

**1. Crown Icon Position (line 501):**

Current:
```tsx
<Crown className="absolute -bottom-1 -right-1 w-3 h-3 text-brand-gold" />
```

Updated:
```tsx
<Crown className="absolute -top-1 -right-1 w-3 h-3 text-brand-gold" />
```

**2. Handicap Display Format (line 460):**

Current:
```tsx
<div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}/{h.handicapIndex}</div>
```

Updated:
```tsx
<div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}/idx {h.handicapIndex}</div>
```

This will display the hole header as:
```
1
4/idx 9
```

---

### Visual Result

**Before:**
| Element | Position/Format |
|---------|-----------------|
| Crown icon | Bottom-right of score cell |
| Handicap | `4/12` |

**After:**
| Element | Position/Format |
|---------|-----------------|
| Crown icon | Top-right of score cell |
| Handicap | `4/idx 12` |

---

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/Scorecard.tsx` | 501 | Change `-bottom-1` to `-top-1` for crown positioning |
| `src/components/Scorecard.tsx` | 460 | Add "idx " prefix before handicap index |

