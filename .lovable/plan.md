

## Fix "Return to Hole" Button Navigation

### Change

Update the "Return to Hole" button in `src/components/Scorecard.tsx` (lines 1277-1285) to navigate to the **first incomplete hole** instead of the last hole with scores.

### Current behavior
The button finds the highest-numbered hole that has any score entered and navigates there. This can skip over holes that were missed or left incomplete.

### New behavior
The button will find the first hole where not every player has a valid score (number > 0) entered and navigate there. If all holes are complete, it defaults to hole 1.

### Technical details

**File:** `src/components/Scorecard.tsx` (lines 1277-1285)

Replace the `holesWithScores` / `lastHole` logic with:

```typescript
const firstIncompleteHole = currentRound.course.holes.find(hole => {
  const holeScores = currentRound.scores[hole.number];
  if (!holeScores) return true;
  return !currentRound.players.every(p => {
    const score = holeScores[p.id];
    return typeof score === 'number' && score > 0;
  });
})?.number || 1;
```

And update the Button's `onClick` to use `startHole: firstIncompleteHole`.

