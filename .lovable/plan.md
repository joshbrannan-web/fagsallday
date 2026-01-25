

## Plan: Auto-scroll to Top When Changing Holes

### Overview
Add auto-scroll behavior so that when users navigate between holes (using the left/right chevron buttons), the main content area automatically scrolls to the top. This provides a consistent starting position for each hole's scoring view.

---

### Technical Approach

Use a React `useRef` to reference the main scrollable container, then add a `useEffect` that scrolls to the top whenever `activeHole` changes.

---

### Implementation Details

**File:** `src/components/ActiveRound.tsx`

#### Step 1: Add a ref for the scrollable container

Near line 31 (with other state declarations), add:

```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

Also add `useRef` to the React import on line 1.

#### Step 2: Add useEffect to scroll on hole change

After the existing `useEffect` hooks (around line 193), add:

```tsx
// Auto-scroll to top when changing holes
useEffect(() => {
  if (scrollContainerRef.current) {
    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }
}, [activeHole]);
```

#### Step 3: Attach the ref to the scrollable container

On line 563, update the main content div to include the ref:

```tsx
<div 
  ref={scrollContainerRef}
  className={`flex-1 overflow-y-auto p-4 space-y-4 ${
    isBottomBarMinimized ? 'pb-16' : 'pb-48'
  }`}
>
```

---

### Summary of Changes

| Location | Change |
|----------|--------|
| Line 1 | Add `useRef` to React import |
| Line ~31 | Add `scrollContainerRef` declaration |
| Line ~193 | Add `useEffect` for auto-scroll on `activeHole` change |
| Line 563 | Attach `ref={scrollContainerRef}` to scrollable container |

---

### Behavior

- **Smooth scroll**: Uses `behavior: 'smooth'` for a polished animation
- **Triggers on**: Any change to `activeHole` (prev/next buttons, or navigating from scorecard)
- **Target**: The main content area that contains all scoring cards and game sections

