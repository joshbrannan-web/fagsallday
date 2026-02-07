

## Fix: Black Image on Share Scorecard

### Root Cause

The hidden scorecard capture container uses `opacity-0` (Tailwind) to hide it from view. When `html-to-image` clones this element for PNG generation, it preserves `opacity: 0`, making all content fully transparent. Transparent pixels render as **black** in most image viewers and messaging apps.

### Fix

**File: `src/components/Scorecard.tsx`** (line ~670)

Add `style: { opacity: '1' }` to the `toPng` options so the cloned node is rendered at full opacity during capture:

```typescript
const dataUrl = await toPng(scorecardRef.current, {
  quality: 0.95,
  backgroundColor: '#ffffff',
  pixelRatio: 2,
  style: { opacity: '1' },  // Force full opacity on cloned node
});
```

This is a single-line addition. The original hidden div stays invisible on screen (opacity-0 remains in the className), but the cloned copy used for image generation renders at full opacity.

### Files Changed

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Add `style: { opacity: '1' }` to the `toPng` options object (1 line) |

