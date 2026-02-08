

## Update "Return to Hole" Button on Scorecard Page

### What Changes
The "Return to Hole" button at the bottom of the Scorecard page will become context-aware:

1. **All holes complete** -- The button changes to "Round Complete" with a flag icon, and navigates to the Round Summary page (`/summary`) instead of the Active Round page.

2. **Holes remaining** -- The button stays as "Return to Hole" with a play icon, and navigates to the **last hole where a score was recorded** (current behavior, already correct).

### How "All Holes Complete" Is Determined
A hole is considered complete when **every player** in the round has a score recorded for that hole. The round is complete when all holes in the course (`currentRound.course.holes`) are complete.

### Technical Details

**File: `src/components/Scorecard.tsx` (lines 1488-1502)**

Replace the current static "Return to Hole" button with conditional logic:

```typescript
// Determine if all holes are complete
const totalHoles = currentRound.course.holes.length;
const allHolesComplete = currentRound.course.holes.every(hole => {
  const holeScores = currentRound.scores[hole.number];
  if (!holeScores) return false;
  return currentRound.players.every(p => {
    const score = holeScores[p.id];
    return score !== undefined && score !== null && score > 0;
  });
});
```

Then in the JSX:
- If `allHolesComplete`: render a button labeled "Round Complete" with `Flag` icon, navigating to `/summary`
- Otherwise: render the existing "Return to Hole" button with `Play` icon, navigating to `/active` with the last scored hole

No other files are affected. The logic for finding the "last hole with a score" remains unchanged.
