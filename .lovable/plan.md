# FBO Head-to-Head Handicap Fix - IMPLEMENTED

## Summary
Fixed FBO Head-to-Head mode to calculate handicap strokes independently for each 1v1 matchup, rather than using the entire player pool as reference.

## Key Changes

### 1. New Function: `calculateFBOMatchupHoleWinner`
- Calculates dot winner for a specific 1v1 matchup on a hole
- Uses ONLY the two players in that matchup for relative handicap calculation
- The lower handicap player of the pair becomes the reference (gets 0 strokes)

### 2. New Data Structure: `matchupDots`
Instead of storing global `dots` array per hole, H2H mode now stores:
```typescript
gameData[fboGameId][holeNumber] = {
  matchupDots: {
    "player1Id_player2Id": "winnerId" | null  // null = tie
  }
}
```

### 3. Files Modified
- `src/services/gameEngine.ts`: Added `calculateFBOMatchupHoleWinner`, updated `calculateFBO` settlement to use `matchupDots`
- `src/components/ActiveRound.tsx`: Updated FBO dots effect to calculate per-matchup dots in H2H mode
- `src/components/Scorecard.tsx`: Updated `FBOMatchupResults` to read from `matchupDots`

## Example: Corrected Behavior

**Players:** Josh (HCP 10), Brandon (HCP 7), Clint (HCP 16)
**Hole 1:** Handicap Index 9, All score 4

| Matchup | Reference | Differentials | Strokes | Net | Winner |
|---------|-----------|---------------|---------|-----|--------|
| Josh vs Brandon | Brandon (7) | J:3, B:0 | J:0, B:0 | 4 vs 4 | TIE |
| Josh vs Clint | Josh (10) | J:0, C:6 | J:0, C:0 | 4 vs 4 | TIE |
| Brandon vs Clint | Brandon (7) | B:0, C:9 | B:0, C:1 | 4 vs 3 | CLINT |

Clint only gets a dot in the Brandon vs Clint matchup (not Josh vs Clint).
