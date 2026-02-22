

## Sync Return-to-Hole Logic and Improve Scorecard Navigation

Three changes across two files:

### 1. RoundSummary: Smart "Return to Hole" navigation
Currently the "Return to Hole" button on the Round Summary page just navigates to `/active` with no state. Update it to use the same logic as the Scorecard: find the first incomplete hole (where not every player has a numeric score > 0) and pass it as `startHole`.

### 2. Scorecard: Remove back arrow button
Remove the back arrow (`ArrowLeft`) button in the sticky header bar. The header will just show "Scorecard" centered, with a spacer on both sides for balance.

### 3. Scorecard: Highlight the current hole
Highlight the column header of the first incomplete hole so the user understands they can click it to return to scoring. The highlight will use a distinct background color (e.g., `bg-primary/20` with a ring) on that hole's `<th>` element, making it visually stand out from the other hole numbers.

### Technical Details

**File: `src/components/RoundSummary.tsx`**

- Compute `firstIncompleteHole` using the same logic as Scorecard (lines 1295-1302): find the first hole where not every player has a score > 0
- Update the "Return to Hole" button (currently around line 492) to navigate with `{ state: { startHole: firstIncompleteHole } }`

**File: `src/components/Scorecard.tsx`**

- Remove the back arrow button from the header (line 837), and replace it with a `<div className="w-10" />` spacer (matching the right side)
- Remove `ArrowLeft` from the lucide-react import
- Compute `firstIncompleteHole` once at the component level (move it out of the bottom button IIFE so it can be reused)
- In the hole header `<th>` elements (lines 878-886), add a conditional highlight class when `h.number === firstIncompleteHole` -- something like a primary-colored ring and background tint to draw the user's eye

