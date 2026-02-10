

## Remove Favorites Section from Past Rounds

### Summary
Remove the "Favorites" category from the Past Rounds page. The star/favorite functionality will remain on round cards, but favorites will only be surfaced in the Setup Wizard (Step 1) for quick course selection.

### Changes

**File: `src/components/RoundHistory.tsx`**

1. Remove the `favoriteRounds` filtered array (lines ~128-130)
2. Remove the entire Favorites rendering block (the `{favoriteRounds.length > 0 && ...}` JSX section)
3. Keep the star toggle button on individual round cards so users can still mark/unmark favorites from this page

### What Stays the Same
- Star icon on each round card still toggles favorite status
- Favorites continue to appear in the Setup Wizard Step 1 for quick course selection
- Recent Rounds and Completed Rounds sections remain unchanged

