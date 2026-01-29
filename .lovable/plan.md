

## Plan: Enhanced FBO Configuration with Separate Press Options

This plan adds three major configuration options to the FBO (Front/Back/Overall) game:

1. **Handicap Mode Selection** - Choose between "All Players Get Strokes" (Absolute) or "Lowest Handicap = 0" (Relative)
2. **Game Mode Selection** - Choose between "All Together" (everyone competes in one pool) or "Head to Head" (players compete in multiple 1v1 matchups with configurable stakes)
3. **Separate Back 9 & Overall Presses** - When past dormie, players can press Back 9 and/or Overall independently or together

---

## Part 1: Handicap Mode Selection

### Current Behavior
- FBO is hardcoded to "Absolute" mode
- No option to use relative handicaps (lowest = 0)

### Solution
Add a radio selection in SetupWizard and update engine calculations.

---

## Part 2: Head-to-Head Game Mode

### Current Behavior
- All FBO players compete in one pool
- Single winner takes from all losers per segment

### Solution
Add a "Head to Head" mode where users can create multiple 1v1 matchups with individual stakes.

---

## Part 3: Separate Back 9 & Overall Presses (NEW)

### Current Behavior
- When on Back 9 (holes 10-18), players can only press the Back 9 segment
- Overall segment cannot be pressed separately
- Players cannot choose which segment(s) to press

### Solution
When a player is past dormie on the Back 9, show them two separate press options:
1. **Press Back 9** - Counts dots from press hole to hole 18
2. **Press Overall** - Counts dots from press hole to hole 18, settled when round complete

When a player is dormie on BOTH Back 9 AND Overall simultaneously, they can:
- Press just Back 9
- Press just Overall  
- Press BOTH (two separate bets)

This requires:
1. New dormie detection for Overall segment
2. Separate UI buttons for Back 9 vs Overall when on Back 9
3. Updated press settlement logic for Overall presses

---

## Implementation Details

### File 1: `src/types.ts`

Expand FBO config interface:

```typescript
fbo?: {
  allowPresses: boolean;
  handicapMode?: 'absolute' | 'relative';           // NEW
  gameMode?: 'together' | 'headToHead';             // NEW
  headToHeadMatchups?: Array<{                      // NEW
    player1Id: string;
    player2Id: string;
    unitValue: number;
  }>;
};
```

Note: `FBOPressState.segment` already supports `'front' | 'back' | 'overall'` - no change needed.

---

### File 2: `src/components/SetupWizard.tsx`

Add new FBO configuration UI sections:

```text
FBO Configuration
-----------------
Players in FBO
  [Player selection buttons - existing]

Allow Presses
  [Switch - existing]

Handicap Mode (visible when Use Handicaps is on globally)
  ( ) All Players Get Strokes
      Each player's strokes calculated from their full handicap.
  ( ) Lowest Handicap = 0
      Strokes based on differential from lowest handicap player.

Game Mode
  ( ) All Together
      Everyone competes in one pool. Most dots wins each segment.
  ( ) Head to Head
      Create 1v1 matchups with separate stakes.

Head-to-Head Matchups (visible when Head to Head is selected)
  +---------------------------+
  | Matchup          | Stake  |
  +---------------------------+
  | [x] John vs Mike | $10    |
  | [x] John vs Sam  | $10    |
  | [ ] John vs Tom  | -      |
  | [x] Mike vs Sam  | $5     |
  +---------------------------+
```

---

### File 3: `src/services/gameEngine.ts`

#### Change 1: Update `calculateFBOStrokes` for Relative Mode

Add `handicapMode` parameter and implement relative logic:

```typescript
export const calculateFBOStrokes = (
  player: Player,
  hole: Hole,
  handicapMode: 'absolute' | 'relative' = 'absolute',
  lowestCourseHandicap: number = 0
): boolean => {
  if (handicapMode === 'relative') {
    const differential = player.courseHandicap - lowestCourseHandicap;
    return differential >= hole.handicapIndex;
  }
  // Existing absolute logic
  return player.courseHandicap >= hole.handicapIndex;
};
```

#### Change 2: Add `getFBOOverallDormieStatus` function

New function to detect dormie status for Overall segment (all 18 holes):

```typescript
export const getFBOOverallDormieStatus = (
  round: Round,
  game: GameSettings,
  currentHole: number
): { [playerId: string]: { isDormie: boolean; dotsBehind: number; holesRemaining: number } } => {
  // Count all dots from hole 1 to currentHole-1
  // Calculate if player can catch up by end of hole 18
  // Return dormie status for Overall segment
};
```

#### Change 3: Add `getFBOPressEligibilityOverall` function

New function to check press eligibility for Overall segment:

```typescript
export const getFBOPressEligibilityOverall = (
  round: Round,
  game: GameSettings,
  playerId: string,
  currentHole: number
): { canPress: boolean; pressLevel: number; reason?: string } => {
  // Check existing Overall presses by this player
  // Check if player is dormie on Overall (or their most recent Overall press)
  // Return eligibility
};
```

#### Change 4: Update press settlement logic in `calculateFBO`

Handle Overall presses (settle at end of round):

```typescript
// In calculateFBO, update press processing:
const segmentEnd = press.segment === 'front' ? 9 : 
                   press.segment === 'back' ? 18 : 
                   18; // Overall also ends at 18

const isSegmentComplete = press.segment === 'front' ? frontNineComplete :
                          press.segment === 'back' ? backNineComplete :
                          overallComplete; // Overall needs full round
```

#### Change 5: Add Head-to-Head calculation mode

New helper function for matchup-based calculations:

```typescript
const calculateFBOHeadToHead = (
  round: Round,
  game: GameSettings,
  matchups: Array<{ player1Id: string; player2Id: string; unitValue: number }>
): { playerResults: { [id: string]: number }; details: string[] } => {
  // For each matchup, count dots independently
  // Determine winner per segment for each matchup
  // Apply stakes per matchup
};
```

---

### File 4: `src/components/ActiveRound.tsx`

#### Change 1: Update `handleFBOPress` to accept 'overall' segment

```typescript
const handleFBOPress = (
  gameId: string, 
  playerId: string, 
  segment: 'front' | 'back' | 'overall',  // Add 'overall'
  pressLevel: number = 1
) => {
  // Existing logic works, just update toast message
  const segmentLabel = segment === 'front' ? 'Front 9' : 
                       segment === 'back' ? 'Back 9' : 
                       'Overall';
  toast.success(`${player?.name} ${pressLabel} the ${segmentLabel}!`);
};
```

#### Change 2: Update FBO Press UI to show separate Back 9 / Overall buttons

When on Back 9 (activeHole > 9), check eligibility for both segments:

```tsx
{activeHole > 9 && (
  <>
    {/* Back 9 Press Button */}
    {backPressEligibility.canPress && (
      <button onClick={() => handleFBOPress(game.id, player.id, 'back', backPressEligibility.pressLevel)}>
        Press Back 9 (${game.unitStake})
      </button>
    )}
    
    {/* Overall Press Button */}
    {overallPressEligibility.canPress && (
      <button onClick={() => handleFBOPress(game.id, player.id, 'overall', overallPressEligibility.pressLevel)}>
        Press Overall (${game.unitStake})
      </button>
    )}
    
    {/* Both Button (convenience) */}
    {backPressEligibility.canPress && overallPressEligibility.canPress && (
      <button onClick={() => {
        handleFBOPress(game.id, player.id, 'back', backPressEligibility.pressLevel);
        handleFBOPress(game.id, player.id, 'overall', overallPressEligibility.pressLevel);
      }}>
        Press Both (${game.unitStake * 2})
      </button>
    )}
  </>
)}
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/types.ts` | Add `handicapMode`, `gameMode`, `headToHeadMatchups` to FBO config |
| `src/components/SetupWizard.tsx` | Add handicap mode radio, game mode radio, and matchup builder UI |
| `src/services/gameEngine.ts` | Add Overall dormie detection, update stroke calculation for relative mode, update press settlement for Overall, add head-to-head calculation |
| `src/components/ActiveRound.tsx` | Update press handler for 'overall' segment, show separate Back 9/Overall press buttons |
| `src/components/Scorecard.tsx` | Update press indicator row to show 'O' for Overall presses |

---

## User Experience Flow

### On Back 9 (Holes 10-18) with Presses Enabled:

1. System calculates dormie status for **both** Back 9 and Overall
2. If player is past dormie on Back 9 only:
   - Show "Press Back 9" button
3. If player is past dormie on Overall only:
   - Show "Press Overall" button
4. If player is past dormie on BOTH:
   - Show "Press Back 9" button
   - Show "Press Overall" button
   - Show "Press Both" button (convenience for pressing both at once)

### Press Settlement:
- Back 9 presses settle when hole 18 is complete (compare dots from startHole to 18)
- Overall presses settle when hole 18 is complete (compare dots from startHole to 18, but conceptually the bet is on the full round's outcome)

---

## Edge Cases Handled

1. **Front 9 presses**: Only "Back" option available (no Overall until round progresses)
2. **Double/Triple presses**: Each segment tracks press levels independently
3. **Press Both**: Creates two separate press records (one Back, one Overall)
4. **Head-to-Head + Presses**: Presses work per-matchup, not globally
5. **Scorecard display**: Shows segment indicator (F9/B9/O) for each press

---

## Expected Outcome

After implementation:
1. Users can choose Absolute or Relative handicap mode for FBO
2. Users can create 1v1 matchups with custom stakes instead of all-together pool
3. When past dormie on Back 9, players see separate "Press Back 9" and "Press Overall" options
4. Players can press one or both segments independently
5. All presses are tracked and settled correctly per segment

