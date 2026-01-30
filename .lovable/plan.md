
## Plan: Press Button Toggle UI + Scorecard Bogey Square Styling

### Overview
Two UI improvements:
1. **Press Buttons**: Change pressed state to show green with a checkmark, allowing users to deselect/undo a press
2. **Scorecard Scores**: Use a circle for birdies and a square for bogeys

---

## Part 1: Press Button Toggle State

### Current Behavior
- Press buttons show amber/primary color
- Clicking adds a press to `_META_PRESSES` array
- No visual indication that a press has been made
- No way to undo a press

### New Behavior
- After pressing, button turns **green** with a **checkmark icon**
- Clicking the green button **removes** the press (undo/deselect)
- Button text changes from "Press F9" to "Pressed F9 ✓"

---

### File: `src/components/ActiveRound.tsx`

#### Change 1: H2H Mode Press Buttons (lines 1186-1225)

For each matchup, check if a press already exists for the segment:

```typescript
// Check if press already exists for this matchup/segment
const getPressExists = (playerId: string, opponentId: string, segment: 'front' | 'back' | 'overall'): boolean => {
  const fboGameData = currentRound.gameData?.[fboGame.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  return presses.some(p => 
    String(p.playerId) === String(playerId) &&
    String(p.opponentId) === String(opponentId) &&
    p.segment === segment
  );
};
```

Update button rendering to show toggle state:

```tsx
{pm.segmentDormie && (() => {
  const isPressed = getPressExists(pm.dormiePlayerId, pm.opponentId, segment);
  return (
    <button
      onClick={() => isPressed 
        ? handleFBOUnpress(fboGame.id, pm.dormiePlayerId, segment, pm.opponentId)
        : handleFBOPress(fboGame.id, pm.dormiePlayerId, segment, 1, pm.opponentId)
      }
      className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
        isPressed 
          ? 'bg-success text-success-foreground hover:bg-success/80' 
          : 'bg-amber-500 text-white hover:bg-amber-600'
      }`}
    >
      <div className="flex items-center justify-center gap-1">
        {isPressed && <Check className="w-4 h-4" />}
        {isPressed ? 'Pressed' : 'Press'} {segment === 'front' ? 'F9' : 'B9'}
      </div>
      <span className="block text-xs font-normal opacity-80">${pm.matchup.unitValue}</span>
    </button>
  );
})()}
```

#### Change 2: Add handleFBOUnpress Function (after handleFBOPress, around line 412)

```typescript
// Handler to remove/undo an FBO press
const handleFBOUnpress = (
  gameId: string, 
  playerId: string, 
  segment: 'front' | 'back' | 'overall', 
  opponentId?: string
) => {
  const fboGameData = currentRound.gameData?.[gameId] || {};
  const existingPresses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
  
  // Filter out the press to remove
  const updatedPresses = existingPresses.filter(p => {
    const matchesPlayer = String(p.playerId) === String(playerId);
    const matchesSegment = p.segment === segment;
    const matchesOpponent = opponentId 
      ? String(p.opponentId) === String(opponentId)
      : !p.opponentId;
    return !(matchesPlayer && matchesSegment && matchesOpponent);
  });
  
  updateGameData(gameId, 1 as any, '_META_PRESSES' as any, updatedPresses);
  
  const player = currentRound.players.find(p => p.id === playerId);
  const segmentLabel = segment === 'front' ? 'Front 9' : 
                       segment === 'back' ? 'Back 9' : 
                       'Overall';
  
  import('sonner').then(({ toast }) => {
    toast.info(`${player?.name} cancelled ${segmentLabel} press`);
  });
};
```

#### Change 3: Update "All Together" Mode Press Buttons (lines 1297-1335)

Apply the same toggle pattern for non-H2H mode:

```typescript
// Check if press exists for non-H2H mode
const checkPoolPressExists = (playerId: string, segment: 'front' | 'back' | 'overall'): boolean => {
  const fboGameData = currentRound.gameData?.[fboGame.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  return presses.some(p => 
    String(p.playerId) === String(playerId) &&
    p.segment === segment &&
    !p.opponentId // Pool mode has no opponent
  );
};

// Update button to toggle:
{canPressBack && (() => {
  const isPressed = checkPoolPressExists(player.id, segment);
  return (
    <button
      onClick={() => isPressed
        ? handleFBOUnpress(fboGame.id, player.id, segment)
        : handleFBOPress(fboGame.id, player.id, segment, backElig!.eligibility.pressLevel)
      }
      className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
        isPressed 
          ? 'bg-success text-success-foreground' 
          : 'bg-amber-500 text-white hover:bg-amber-600'
      }`}
    >
      <div className="flex items-center justify-center gap-1">
        {isPressed && <Check className="w-4 h-4" />}
        {isPressed ? 'Pressed' : backPressLabel} {activeHole <= 9 ? 'F9' : 'B9'}
      </div>
      <span className="block text-xs font-normal opacity-80">${fboGame.unitStake}</span>
    </button>
  );
})()}
```

#### Change 4: Import Check Icon

Add `Check` to the lucide-react imports at the top of the file.

---

## Part 2: Scorecard Bogey Square Styling

### Current Behavior
All scores use `rounded-full` (circle) regardless of whether it's a birdie or bogey.

### New Behavior
- **Circle** (`rounded-full`): For birdies (1 under par) and eagles (2+ under par)
- **Square** (`rounded-lg`): For bogeys (1 over par) and double bogeys+ (2+ over par)
- **No border**: For par scores

---

### File: `src/components/Scorecard.tsx` (lines 944-955)

Update the score cell styling logic:

```tsx
{activeHoles.map(h => {
  const score = getPlayerScore(player.id, h.number);
  const diff = typeof score === 'number' ? score - h.par : 0;
  
  // Determine shape: circle for birdies/eagles, square for bogeys+
  const isUnderPar = diff < 0;
  const isOverPar = diff > 0;
  const shapeClass = isUnderPar ? 'rounded-full' : isOverPar ? 'rounded-lg' : '';
  
  // Check for stroke indicator
  let hasStroke = currentRound.gameData?.['MANUAL_STROKES']?.[h.number]?.[player.id] === 1;
  if (!hasStroke && stockton6Game) {
    const autoStrokes = calculateRelativeStrokes(currentRound.players, h.handicapIndex);
    hasStroke = autoStrokes[player.id] === 1;
  }
  const isBanker = getBankerForHole(h.number) === player.id;
  
  return (
    <td key={h.number} className="p-2 border-r border-border/50">
      <div className="relative inline-block">
        <span className={`inline-block w-8 h-8 leading-8 ${shapeClass} text-sm font-bold ${
          diff <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
          diff === -1 ? 'bg-success/20 text-success' :
          diff === 0 ? '' :
          diff === 1 ? 'bg-destructive/10 text-destructive' :
          'bg-destructive/20 text-destructive'
        }`}>
          {score}
        </span>
        {hasStroke && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border border-background flex items-center justify-center">
            <span className="text-[8px] text-primary-foreground font-bold">•</span>
          </span>
        )}
        {isBanker && (
          <Crown className="absolute -top-1 -right-1 w-3 h-3 text-brand-gold" />
        )}
      </div>
    </td>
  );
})}
```

**Key Change:**
- `rounded-full` → Only applied when `diff < 0` (under par)
- `rounded-lg` → Applied when `diff > 0` (over par)
- No border class → For par scores

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/components/ActiveRound.tsx` | 1. Add `handleFBOUnpress` function<br>2. Add `Check` icon import<br>3. Update H2H press buttons to toggle green/amber with checkmark<br>4. Update "All Together" press buttons to toggle green/amber with checkmark |
| `src/components/Scorecard.tsx` | Update score cell styling to use circle for birdies, square for bogeys |

---

## Visual Summary

### Press Button States

| State | Color | Icon | Text |
|-------|-------|------|------|
| Not pressed | Amber (amber-500) | None | "Press F9" |
| Pressed | Green (success) | ✓ Checkmark | "Pressed F9" |

### Score Cell Shapes

| Score | Shape | Background |
|-------|-------|------------|
| Eagle (-2) | Circle | Gold |
| Birdie (-1) | Circle | Green |
| Par (0) | None | None |
| Bogey (+1) | Square | Light Red |
| Double+ (+2) | Square | Red |

