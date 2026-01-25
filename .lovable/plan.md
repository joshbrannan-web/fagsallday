

## Plan: Fix 6's Press Score Display in Scorecard

### Problem
The `SixesMatchSummary.tsx` component is recalculating press hole results inline using **simplified logic** that doesn't match the actual game engine. This causes incorrect press scores to be displayed.

The display shows Team B winning 1-0 when they actually won 2-0 because:
1. The inline calculation doesn't use the proper `calculateSixesStrokes` function with its "cancel all strokes if everyone gets one" logic
2. It doesn't properly handle the 2nd ball tiebreaker setting
3. It doesn't use the `handicapMode` setting from metadata

---

### Current Code (Broken)

**File:** `src/components/sixes/SixesMatchSummary.tsx` (lines 177-199)

```tsx
// Determine hole winner (simplified - uses same logic as stretch)
const holeData = round.course.holes.find(h2 => h2.number === h);
if (!holeData) continue;

// Get net scores for this hole - SIMPLIFIED AND WRONG
const getPlayerNet = (playerId: string): number => {
  const gross = holeScores[playerId] as number;
  const player = round.players.find(p => p.id === playerId);
  if (!assignment.useHandicaps || !player) return gross;
  // Simplified stroke calculation - MISSING absolute mode logic!
  const stroke = holeData.handicapIndex <= player.courseHandicap ? 1 : 0;
  return gross - stroke;
};

const teamANets = assignment.teamA.map(getPlayerNet);
const teamBNets = assignment.teamB.map(getPlayerNet);

const teamA1stBall = Math.min(...teamANets);
const teamB1stBall = Math.min(...teamBNets);

// MISSING: 2nd ball tiebreaker logic!
if (teamA1stBall < teamB1stBall) teamAWinsInPress++;
else if (teamB1stBall < teamA1stBall) teamBWinsInPress++;
```

---

### Solution

Replace the inline calculation with a call to the existing `calculateSixesHoleResult` function from the engine, which already handles:
- Absolute vs relative handicap mode
- "Cancel all strokes" logic when everyone gets a stroke  
- 2nd ball tiebreaker
- All edge cases

---

### Proposed Code

**File:** `src/components/sixes/SixesMatchSummary.tsx`

#### Step 1: Import the calculateSixesHoleResult function

Update line 3 to add `calculateSixesHoleResult`:

```tsx
import { 
  getSixesTeamAssignment, 
  calculateSixesStretchResult, 
  calculateSixesStretchPayouts,
  getSixesPresses,
  calculateSixesPressPayouts,
  calculateSixesHoleResult,  // ADD THIS
  SIXES_STRETCH_HOLES 
} from '../../services/sixesEngine';
```

#### Step 2: Replace the inline calculation (lines 166-199)

Replace the broken inline calculation with a call to the engine:

```tsx
for (let h = press.startHole; h <= stretchEndHole; h++) {
  const holeScores = round.scores[h];
  if (!holeScores) continue;
  
  // Check if hole is complete
  const allPlayers = [...assignment.teamA, ...assignment.teamB];
  const allHaveScores = allPlayers.every(pid => typeof holeScores[pid] === 'number');
  if (!allHaveScores) continue;
  
  holesInPressPlayed++;
  
  // Use the proper engine function for correct calculation
  const holeResult = calculateSixesHoleResult(
    round,
    h,
    assignment.teamA,
    assignment.teamB,
    assignment.useHandicaps,
    assignment.useSecondBallTiebreaker || false,
    assignment.handicapMode || 'absolute'
  );
  
  if (holeResult === 'A') teamAWinsInPress++;
  else if (holeResult === 'B') teamBWinsInPress++;
  // TIE is not counted for either team
}
```

---

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/sixes/SixesMatchSummary.tsx` | 3-10 | Add `calculateSixesHoleResult` to import |
| `src/components/sixes/SixesMatchSummary.tsx` | 166-199 | Replace inline calculation with engine function call |

---

### Why This Fixes It

The `calculateSixesHoleResult` function in the engine:
1. Uses `calculateSixesStrokes()` which properly cancels all strokes when everyone gets one
2. Respects the `handicapMode` setting (absolute vs relative)
3. Properly handles the 2nd ball tiebreaker when enabled
4. Is the same function used for the main stretch calculation, ensuring consistency

This will make the press display match the actual game results.

