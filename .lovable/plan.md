

## Plan: Fix FBO Head-to-Head Handicap Calculations

### Problem Summary
In FBO Head-to-Head mode with "relative" handicaps, the current implementation uses the **entire FBO player pool** to find the lowest handicap player as the reference. This is incorrect - each 1v1 matchup should calculate relative handicaps based only on **the two players in that specific matchup**.

**Example from current round:**
- Josh (HCP 10), Brandon (HCP 7), Clint (HCP 16) playing FBO
- Matchups: Josh vs Brandon, Josh vs Clint, Brandon vs Clint
- On Hole 1 (Handicap Index 9):
  - **Current (wrong)**: Uses Brandon (HCP 7) as reference for ALL matchups
    - Josh: 10-7=3 differential (no stroke on index 9)
    - Clint: 16-7=9 differential (stroke on index 9)
  - **Correct for Josh vs Clint matchup**: Should use Josh (HCP 10) as reference
    - Josh: 10-10=0 differential (no stroke)
    - Clint: 16-10=6 differential (no stroke on index 9, since 6 < 9)

---

## Solution Overview

Instead of storing a single `dots` array per hole (which assumes one global dot winner), store **per-matchup dot results** when in Head-to-Head mode. Each matchup independently determines who wins the dot based on their relative handicap calculation.

---

## Implementation Details

### File 1: `src/services/gameEngine.ts`

#### Change 1: Add new function `calculateFBOMatchupHoleWinner`

Calculate the dot winner for a specific 1v1 matchup on a hole:

```typescript
export const calculateFBOMatchupHoleWinner = (
  round: Round,
  game: GameSettings,
  holeNumber: number,
  player1Id: string,
  player2Id: string
): string | null => {
  const hole = round.course.holes.find(h => h.number === holeNumber);
  const holeScores = round.scores[holeNumber];
  if (!hole || !holeScores) return null;

  const player1 = round.players.find(p => String(p.id) === String(player1Id));
  const player2 = round.players.find(p => String(p.id) === String(player2Id));
  if (!player1 || !player2) return null;

  // Check both players have scores
  const p1Score = holeScores[player1.id];
  const p2Score = holeScores[player2.id];
  if (typeof p1Score !== 'number' || p1Score <= 0) return null;
  if (typeof p2Score !== 'number' || p2Score <= 0) return null;

  const handicapMode = game.config.fbo?.handicapMode || 'absolute';

  // Calculate strokes for ONLY these two players
  const strokes = calculateFBOStrokes(
    [player1, player2],  // Only pass the two matchup players
    hole.handicapIndex,
    handicapMode
  );

  const p1Net = p1Score - strokes[player1.id];
  const p2Net = p2Score - strokes[player2.id];

  if (p1Net < p2Net) return player1.id;
  if (p2Net < p1Net) return player2.id;
  return null; // Tie = no dot for either
};
```

---

### File 2: `src/components/ActiveRound.tsx`

#### Change 1: Update auto-calculate FBO dots effect (lines 173-196)

When in Head-to-Head mode, calculate and store dots per matchup instead of global dots:

```typescript
useEffect(() => {
  if (!currentRound) return;
  
  const fboGames = currentRound.games.filter(g => g.type === GameType.FBO);
  if (fboGames.length === 0) return;
  
  fboGames.forEach(game => {
    const isHeadToHead = game.config.fbo?.gameMode === 'headToHead';
    const matchups = game.config.fbo?.headToHeadMatchups || [];
    
    if (isHeadToHead && matchups.length > 0) {
      // HEAD-TO-HEAD MODE: Calculate dots per matchup
      const matchupDots: { [matchupKey: string]: string | null } = {};
      
      matchups.forEach(matchup => {
        const winner = calculateFBOMatchupHoleWinner(
          currentRound,
          game,
          activeHole,
          matchup.player1Id,
          matchup.player2Id
        );
        const matchupKey = `${matchup.player1Id}_${matchup.player2Id}`;
        matchupDots[matchupKey] = winner;
      });
      
      // Store as matchupDots instead of dots
      const currentMatchupDots = currentRound.gameData?.[game.id]?.[activeHole]?.matchupDots || {};
      const isDifferent = JSON.stringify(matchupDots) !== JSON.stringify(currentMatchupDots);
      
      if (isDifferent && Object.keys(matchupDots).length > 0) {
        updateGameData(game.id, activeHole, 'matchupDots', matchupDots);
      }
    } else {
      // ALL TOGETHER MODE: Existing global dots logic
      const winners = calculateFBOHoleWinners(currentRound, game, activeHole);
      // ... existing code
    }
  });
}, [currentRound?.scores, activeHole, currentRound?.games, updateGameData]);
```

---

### File 3: `src/components/Scorecard.tsx`

#### Change 1: Update `FBOMatchupResults` to use per-matchup dots

Update `countDotsForPlayer` to read from `matchupDots` instead of global `dots`:

```typescript
// Count dots for a player in a SPECIFIC matchup
const countDotsForMatchup = (
  p1Id: string,
  p2Id: string,
  startHole: number,
  endHole: number
): { p1Dots: number; p2Dots: number } => {
  let p1Dots = 0;
  let p2Dots = 0;
  const matchupKey = `${p1Id}_${p2Id}`;
  
  for (let h = startHole; h <= endHole; h++) {
    const matchupDots = fboData[h]?.matchupDots || {};
    const winner = matchupDots[matchupKey];
    if (String(winner) === String(p1Id)) p1Dots++;
    if (String(winner) === String(p2Id)) p2Dots++;
  }
  
  return { p1Dots, p2Dots };
};

// In the matchup rendering:
const { p1Dots: p1FrontDots, p2Dots: p2FrontDots } = countDotsForMatchup(
  matchup.player1Id, matchup.player2Id, 1, 9
);
const { p1Dots: p1BackDots, p2Dots: p2BackDots } = countDotsForMatchup(
  matchup.player1Id, matchup.player2Id, 10, 18
);
```

---

### File 4: `src/services/gameEngine.ts` - Update `calculateFBO`

#### Change 1: Update settlement logic to use per-matchup dots

When calculating payouts for head-to-head mode, read from `matchupDots`:

```typescript
// In calculateFBO, head-to-head segment calculation:
if (isHeadToHead && matchups.length > 0) {
  matchups.forEach(matchup => {
    const matchupKey = `${matchup.player1Id}_${matchup.player2Id}`;
    
    // Count dots from matchupDots for this specific matchup
    let p1Dots = 0, p2Dots = 0;
    for (let h = startHole; h <= endHole; h++) {
      const matchupDots = fboData[h]?.matchupDots || {};
      const winner = matchupDots[matchupKey];
      if (String(winner) === String(matchup.player1Id)) p1Dots++;
      if (String(winner) === String(matchup.player2Id)) p2Dots++;
    }
    
    // Determine winner and apply stakes
    // ...
  });
}
```

---

## Data Structure Change

**Before (All Together mode):**
```typescript
gameData[fboGameId][holeNumber] = {
  dots: ["player1Id", "player2Id"]  // Global winners
}
```

**After (Head-to-Head mode):**
```typescript
gameData[fboGameId][holeNumber] = {
  matchupDots: {
    "player1Id_player2Id": "player1Id",  // Winner for this matchup
    "player1Id_player3Id": "player3Id",  // Different winner for different matchup
    "player2Id_player3Id": null          // Tie in this matchup
  }
}
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/services/gameEngine.ts` | Add `calculateFBOMatchupHoleWinner` function; update `calculateFBO` to read from `matchupDots` for H2H mode |
| `src/components/ActiveRound.tsx` | Update FBO dots effect to calculate per-matchup dots in H2H mode |
| `src/components/Scorecard.tsx` | Update `FBOMatchupResults` to use `matchupDots` instead of global `dots` |

---

## Example: Corrected Behavior

**Players:** Josh (HCP 10), Brandon (HCP 7), Clint (HCP 16)
**Matchups:** Josh vs Brandon, Josh vs Clint, Brandon vs Clint
**Hole 1:** Handicap Index 9, Par 4

**Scores:** Josh 4, Brandon 4, Clint 4

**Per-Matchup Calculations (Relative Mode):**

| Matchup | Reference | Differentials | Strokes | Net Scores | Winner |
|---------|-----------|---------------|---------|------------|--------|
| Josh vs Brandon | Brandon (7) | Josh: 3, Brandon: 0 | Josh: 0, Brandon: 0 | 4 vs 4 | TIE |
| Josh vs Clint | Josh (10) | Josh: 0, Clint: 6 | Josh: 0, Clint: 0 | 4 vs 4 | TIE |
| Brandon vs Clint | Brandon (7) | Brandon: 0, Clint: 9 | Brandon: 0, Clint: 1 | 4 vs 3 | CLINT |

**Result:** Clint gets a dot only in the Brandon vs Clint matchup, not in Josh vs Clint.

---

## Expected Outcome

After implementation:
1. Each head-to-head matchup calculates handicap strokes independently
2. The lower handicap player in each specific matchup is the reference (gets 0 strokes)
3. Dots are stored and tracked per-matchup, not globally
4. Scorecard displays correct dot counts per matchup
5. Presses use the per-matchup dot data for settlements

