

## Plan: Fix Scorecard Image Rendering

### Problem
The "Share Image" feature is not rendering the scorecard correctly. The hidden capture container uses:
1. CSS variables that may not resolve properly for off-screen elements
2. `left-[-9999px]` positioning which can cause `html-to-image` rendering issues
3. No fixed width, causing potential layout collapse

### Solution
Update the hidden capture container to use:
1. **Inline styles with hard-coded colors** instead of CSS variable-based Tailwind classes
2. **Fixed positioning with `opacity-0 pointer-events-none`** instead of off-screen positioning (better for `html-to-image`)
3. **Fixed minimum width** to ensure the 18-hole landscape layout renders properly

---

### Implementation Details

**File: `src/components/Scorecard.tsx`**

#### Change 1: Update Hidden Container Positioning (Lines 837-841)

**Before:**
```tsx
<div 
  ref={scorecardRef}
  className="absolute left-[-9999px] top-0"
  aria-hidden="true"
>
```

**After:**
```tsx
<div 
  ref={scorecardRef}
  className="fixed top-0 left-0 opacity-0 pointer-events-none z-[-1]"
  style={{ width: '1200px' }}
  aria-hidden="true"
>
```

#### Change 2: Replace CSS Variable Classes with Inline Styles (Lines 842-932)

Replace Tailwind color classes with inline styles using hard-coded hex colors:

| CSS Variable | Hex Value |
|-------------|-----------|
| `bg-card` | `#ffffff` |
| `bg-muted` | `#f5f3ef` |
| `bg-muted/50` | `rgba(245,243,239,0.5)` |
| `bg-muted/30` | `rgba(245,243,239,0.3)` |
| `text-foreground` | `#1e2530` |
| `text-muted-foreground` | `#737a85` |
| `border-border` | `#dfe2e7` |
| `text-success` | `#22c55e` |
| `text-destructive` | `#ef4444` |
| `bg-brand-gold/20` | `rgba(245,178,10,0.2)` |
| `text-brand-gold` | `#f5b20a` |
| `bg-success/20` | `rgba(34,197,94,0.2)` |
| `bg-destructive/10` | `rgba(239,68,68,0.1)` |
| `bg-destructive/20` | `rgba(239,68,68,0.2)` |
| `bg-primary` | `#2a9d8f` |
| `text-primary-foreground` | `#ffffff` |

**Key sections to update:**

1. **Outer wrapper** - Add white background
2. **Header div** - Replace `bg-muted/50`, `text-foreground`, `text-muted-foreground`, `border-border`
3. **Table header row** - Replace `bg-muted`, `text-muted-foreground`
4. **Player rows** - Replace alternating `bg-card`/`bg-muted/30`
5. **Score cells** - Replace conditional color classes with inline style logic
6. **Stroke dot** - Replace `bg-primary`, `text-primary-foreground`
7. **Banker crown** - Replace `text-brand-gold`
8. **P&L row** - Replace `text-success`, `text-destructive`, `text-muted-foreground`
9. **Total column** - Replace color-coded money display

---

### Code Changes Summary

The hidden capture container (~100 lines) will be updated to use inline styles throughout, ensuring consistent rendering regardless of CSS variable resolution.

**Example of score cell transformation:**

**Before:**
```tsx
<span className={`inline-block w-8 h-8 leading-8 rounded-full text-sm font-bold ${
  diff <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
  diff === -1 ? 'bg-success/20 text-success' :
  diff === 0 ? '' :
  diff === 1 ? 'bg-destructive/10 text-destructive' :
  'bg-destructive/20 text-destructive'
}`}>
  {score}
</span>
```

**After:**
```tsx
<span 
  style={{
    display: 'inline-block',
    width: '32px',
    height: '32px',
    lineHeight: '32px',
    borderRadius: '50%',
    fontSize: '14px',
    fontWeight: 700,
    ...(diff <= -2 ? { backgroundColor: 'rgba(245,178,10,0.2)', color: '#f5b20a' } :
        diff === -1 ? { backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e' } :
        diff === 0 ? {} :
        diff === 1 ? { backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' } :
        { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' })
  }}
>
  {score}
</span>
```

---

### Files Changed

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Update hidden capture container (lines 837-932) to use inline styles and fixed positioning |

---

### Expected Outcome

After this change:
1. The scorecard image will render with proper colors and layout
2. All 18 holes will display in a landscape format
3. The image will be shareable via text/SMS on mobile devices
4. The generated PNG will have consistent styling regardless of device theme

