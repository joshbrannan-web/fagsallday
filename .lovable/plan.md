

## Updated Plan: FBO Head-to-Head Matchup View with Per-Matchup Presses

### Overview
Create a specialized scorecard view for FBO Head-to-Head mode that displays each 1v1 matchup independently, showing dot counts, segment results, AND press results per matchup.

---

## Part 1: Update FBOPressState for Head-to-Head Context

### Current Issue
- `FBOPressState` only tracks `playerId` (who pressed) and `segment`
- In head-to-head mode, a press should be against a **specific opponent**, not the entire pool
- Current press settlement logic compares pressing player vs all FBO players

### Solution
Add optional `opponentId` field to `FBOPressState`:

**File: `src/types.ts`**

```typescript
export interface FBOPressState {
  playerId: string;
  segment: 'front' | 'back' | 'overall';
  startHole: number;
  unitValue: number;
  settled: boolean;
  pressLevel: number;
  opponentId?: string;  // NEW: For head-to-head mode, who is the press against
  result?: {
    winnerId: string | null;
    amount: number;
  };
}
```

---

## Part 2: Update Press Creation for Head-to-Head Mode

### File: `src/components/ActiveRound.tsx`

When in head-to-head mode, a player can only be past dormie in a **specific matchup**. Update:

1. **Modify press eligibility logic** to check dormie status per-matchup
2. **Update press UI** to show which opponent the press is against
3. **Update `handleFBOPress`** to include `opponentId` when in head-to-head mode

```typescript
const handleFBOPress = (
  gameId: string, 
  playerId: string, 
  segment: 'front' | 'back' | 'overall', 
  pressLevel: number = 1,
  opponentId?: string  // NEW parameter
) => {
  const newPress: FBOPressState = {
    playerId: String(playerId),
    segment,
    startHole: activeHole,
    unitValue: opponentId ? matchup.unitValue : fboGame.unitStake, // Use matchup stake
    settled: false,
    pressLevel,
    opponentId: opponentId ? String(opponentId) : undefined  // NEW
  };
  // ... rest unchanged
};
```

---

## Part 3: Update Press Settlement in Game Engine

### File: `src/services/gameEngine.ts`

Modify press settlement logic to handle head-to-head presses:

```typescript
// In calculateFBO, when processing presses:
if (press.opponentId) {
  // Head-to-head press: only compare pressing player vs opponent
  const p1Dots = pressDots[press.playerId] || 0;
  const p2Dots = pressDots[press.opponentId] || 0;
  
  if (p1Dots > p2Dots) {
    results[press.playerId] += press.unitValue;
    results[press.opponentId] -= press.unitValue;
  } else if (p2Dots > p1Dots) {
    results[press.opponentId] += press.unitValue;
    results[press.playerId] -= press.unitValue;
  }
  // else: push
} else {
  // Global pool press: existing logic
}
```

---

## Part 4: Create FBOMatchupResults Component

### File: `src/components/Scorecard.tsx`

Add new component to display matchups with their presses:

```text
+------------------------------------------+
| John vs Mike                    $10/seg  |
+------------------------------------------+
| Segment   | Front 9 | Back 9 | Overall   |
+-----------+---------+--------+-----------|
| [Trophy] John   3      4         7       |
| [Down]   Mike   2      3         5       |
| Result   +$10    +$10    +$10  = +$30    |
+------------------------------------------+
| PRESSES                                  |
| John pressed B9 on #12: WON +$10         |
| Mike pressed Overall on #14: LOST -$10   |
+------------------------------------------+
```

### Component Structure

```typescript
interface FBOMatchupResultsProps {
  fboGame: GameSettings;
  fboPlayers: Player[];
  scores: { [holeNumber: number]: HoleScores };
  gameData: GameData;
  courseHoles: Hole[];
}

const FBOMatchupResults: React.FC<FBOMatchupResultsProps> = (props) => {
  const matchups = props.fboGame.config.fbo?.headToHeadMatchups || [];
  const presses: FBOPressState[] = gameData[fboGame.id]?.[1]?._META_PRESSES || [];

  return (
    <div className="space-y-4">
      {matchups.map((matchup, idx) => (
        <MatchupCard 
          key={idx}
          matchup={matchup}
          presses={presses.filter(p => 
            // Filter presses for this matchup
            (p.playerId === matchup.player1Id && p.opponentId === matchup.player2Id) ||
            (p.playerId === matchup.player2Id && p.opponentId === matchup.player1Id)
          )}
          {...props}
        />
      ))}
      
      {/* Overall Summary */}
      <MatchupTotalsSummary matchups={matchups} presses={presses} {...props} />
    </div>
  );
};
```

### MatchupCard Component

```typescript
interface MatchupCardProps {
  matchup: { player1Id: string; player2Id: string; unitValue: number };
  presses: FBOPressState[];
  // ... other props from FBOMatchupResultsProps
}

const MatchupCard: React.FC<MatchupCardProps> = ({ matchup, presses, ... }) => {
  // 1. Get player objects
  const player1 = fboPlayers.find(p => p.id === matchup.player1Id);
  const player2 = fboPlayers.find(p => p.id === matchup.player2Id);
  
  // 2. Count dots per segment for each player
  const countDots = (playerId: string, start: number, end: number) => {
    let count = 0;
    for (let h = start; h <= end; h++) {
      if (fboData[h]?.dots?.includes(playerId)) count++;
    }
    return count;
  };
  
  // 3. Determine segment completion (both players scored)
  const isComplete = (start: number, end: number) => { ... };
  
  // 4. Calculate segment winners
  // 5. Display presses associated with this matchup
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <span>{player1.name} vs {player2.name}</span>
          <span className="text-muted-foreground">${matchup.unitValue}/segment</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Segment results table */}
        <table>
          <thead>
            <tr>
              <th>Segment</th>
              <th>Front 9</th>
              <th>Back 9</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {/* Player 1 row with dots and win/loss icons */}
            {/* Player 2 row with dots and win/loss icons */}
            {/* Result row with +/- amounts */}
          </tbody>
        </table>
        
        {/* Presses section (if any for this matchup) */}
        {presses.length > 0 && (
          <div className="border-t mt-4 pt-4">
            <h4>Presses</h4>
            {presses.map((press, idx) => (
              <PressResultRow key={idx} press={press} matchup={matchup} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## Part 5: Update Main FBO Section Rendering

### File: `src/components/Scorecard.tsx`

Modify the FBO section to conditionally render matchup view:

```tsx
{fboGame && fboPlayers.length >= 2 && (
  <>
    {/* FBO Dots Table (existing) */}
    
    {/* Segment Results: Switch based on game mode */}
    {fboGame.config.fbo?.gameMode === 'headToHead' && 
     fboGame.config.fbo?.headToHeadMatchups?.length > 0 ? (
      <FBOMatchupResults 
        fboGame={fboGame}
        fboPlayers={fboPlayers}
        scores={currentRound.scores}
        gameData={currentRound.gameData}
        courseHoles={holes}
      />
    ) : (
      <FBOSegmentResults {...existingProps} />
    )}
  </>
)}
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/types.ts` | Add `opponentId` to `FBOPressState` |
| `src/components/ActiveRound.tsx` | Update `handleFBOPress` to accept `opponentId`; update press UI to show matchup-specific options in H2H mode |
| `src/services/gameEngine.ts` | Update press settlement to handle H2H presses (player vs specific opponent) |
| `src/components/Scorecard.tsx` | Add `FBOMatchupResults` and `MatchupCard` components; update FBO section conditional rendering |

---

## User Experience Flow

### Scorecard View (Head-to-Head Mode):

1. Each configured matchup displayed as a separate card
2. Card shows:
   - Header: "John vs Mike - $10/segment"
   - Table with dot counts for Front 9, Back 9, Overall
   - Winner (trophy) and loser (trending down) per segment
   - +/- amount per segment and total
3. Below the segment table, any presses associated with this matchup
4. At the bottom, overall summary of winnings/losses per player across all matchups

### Press Display Per Matchup:

```text
+------------------------------------------+
| PRESSES                                  |
+------------------------------------------+
| John pressed Back 9 on #12               |
|   J: 3 dots | M: 1 dot → WON +$10        |
+------------------------------------------+
| Mike pressed Overall on #14              |
|   M: 2 dots | J: 4 dots → LOST -$10      |
+------------------------------------------+
```

---

## Edge Cases Handled

1. **No presses**: Matchup card shows segment results only
2. **Multiple presses in same matchup**: Each press displayed separately with its own result
3. **Double/Triple presses**: Show press level in display
4. **Mix of global and H2H presses**: Legacy presses without `opponentId` still work in "All Together" mode
5. **Incomplete segments**: Show "In Progress" for segments and presses not yet settled

---

## Expected Result

After implementation:

1. In Head-to-Head mode, scorecard shows individual matchup cards
2. Each card displays segment results (dots, winners, payouts) for that 1v1
3. Presses are associated with specific matchups and displayed within the relevant card
4. Players can press in specific matchups when past dormie against that opponent
5. Press payouts are calculated per-matchup (winner takes stake from loser, not pool)
6. Overall summary aggregates results across all matchups

