

# Fix: Remove Sticky Scorecard Header

## Problem
The "Scorecard" header bar at the top of the scorecard view uses `sticky top-0`, keeping it pinned while scrolling. On a mobile screen this wastes vertical space and obscures the table content beneath it.

## Fix

**`src/components/Scorecard.tsx` — Line 859**

Remove `sticky top-0 z-10` from the header div so it scrolls away naturally:

```
// Before
<div className="bg-brand-dark text-primary-foreground p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">

// After
<div className="bg-brand-dark text-primary-foreground p-4 shadow-sm flex items-center justify-between">
```

Single line change. The "Scorecard" header will scroll off-screen with the rest of the page, giving the user full viewport for the table.

