

# Fix: Player Column Clipped by Negative Margin

## Problem
The table wrapper uses `-mx-4` (line 101) to make the table stretch edge-to-edge. But the sticky player column is positioned at `left-0` relative to the scroll container. Since `-mx-4` shifts the container 16px left, the first 16px of the player column (the dot and start of "Player" header) get clipped outside the visible area.

## Fix — `src/components/tournament/TournamentScorecardTable.tsx`

**Line 101**: Remove `-mx-4` from the overflow container. The table is already inside a card with its own padding, so the negative margin is unnecessary and causes the clipping.

```
// Before
<div className="overflow-x-auto -mx-4">

// After
<div className="overflow-x-auto">
```

Single line change. The sticky player column, dots, and "Player" header will all be fully visible.

