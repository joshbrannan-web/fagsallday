

## Plan: Implement Double Press (Press-the-Press) for FBO

### Overview
Add "double press" functionality to FBO games, allowing a player who has already pressed to press again if they become dormie on their active press bet. This creates stacking press bets similar to how traditional golf betting works.

---

### Current Behavior
- A player can press once per segment (Front 9 / Back 9)
- `hasExistingFBOPress` prevents showing the Press button if any press exists for that player + segment
- Press payouts count dots from `press.startHole` to `segmentEnd`

### Desired Behavior
- A player can press multiple times per segment if they become dormie on each successive press bet
- Each press is independent and counts from its own `startHole` to `segmentEnd`
- Label buttons as "Press" (1st), "Double Press" (2nd), "Triple Press" (3rd), etc.
- Stack payouts independently for each press bet

---

### Technical Approach

#### Step 1: Add Press Level Tracking

Update the `FBOPressState` interface to track which press level this is:

| File | Change |
|------|--------|
| `src/types.ts` | Add `pressLevel: number` field to `FBOPressState` |

```typescript
export interface FBOPressState {
  playerId: string;
  segment: 'front' | 'back' | 'overall';
  startHole: number;
  unitValue: number;
  settled: boolean;
  pressLevel: number;  // NEW: 1 = first press, 2 = double press, etc.
  result?: {
    winnerId: string | null;
    amount: number;
  };
}
```

---

#### Step 2: Add Dormie Detection for Active Presses

Create a new function to check if a player is dormie on their most recent press bet:

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Add `isFBOPlayerDormieOnPress` function |

```typescript
export const isFBOPlayerDormieOnPress = (
  round: Round,
  game: GameSettings,
  playerId: string,
  press: FBOPressState,
  currentHole: number
): boolean => {
  const fboPlayerIds = game.config.fboPlayers || round.players.map(p => p.id);
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(p.id));
  const fboData = round.gameData?.[game.id] || {};
  
  const segmentEnd = press.segment === 'front' ? 9 : 18;
  const holesRemaining = segmentEnd - currentHole + 1;
  
  // Count dots from press.startHole to currentHole-1 (completed holes)
  const pressDots: { [id: string]: number } = {};
  fboPlayers.forEach(p => pressDots[p.id] = 0);
  
  for (let h = press.startHole; h < currentHole; h++) {
    const holeDots = fboData[h]?.dots || [];
    holeDots.forEach((pid: string | number) => {
      const normalizedId = String(pid);
      if (pressDots[normalizedId] !== undefined) {
        pressDots[normalizedId]++;
      }
    });
  }
  
  const playerDots = pressDots[playerId] || 0;
  const leaderDots = Math.max(...Object.values(pressDots));
  
  // Dormie if can't catch up even winning all remaining holes
  return playerDots + holesRemaining < leaderDots;
};
```

---

#### Step 3: Update Eligibility Check Function

Replace `hasExistingFBOPress` logic to return eligibility info instead of boolean:

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Add `getFBOPressEligibility` function |

```typescript
export const getFBOPressEligibility = (
  round: Round,
  game: GameSettings,
  playerId: string,
  segment: 'front' | 'back',
  currentHole: number
): { canPress: boolean; pressLevel: number; reason?: string } => {
  const fboGameData = round.gameData?.[game.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  
  // Find all presses by this player in this segment
  const playerPresses = presses.filter(p => 
    String(p.playerId) === String(playerId) && 
    p.segment === segment
  );
  
  if (playerPresses.length === 0) {
    // No existing press - check base dormie status
    const dormieStatus = getFBODormieStatus(round, game, currentHole);
    const status = dormieStatus[playerId];
    if (!status?.isDormie) {
      return { canPress: false, pressLevel: 1, reason: 'Not dormie' };
    }
    return { canPress: true, pressLevel: 1 };
  }
  
  // Has existing press(es) - check if dormie on the most recent press
  const latestPress = playerPresses.reduce((a, b) => 
    a.startHole > b.startHole ? a : b
  );
  
  // Can't press again on same hole as latest press
  if (latestPress.startHole >= currentHole) {
    return { canPress: false, pressLevel: latestPress.pressLevel + 1, reason: 'Already pressed this hole' };
  }
  
  const isDormieOnPress = isFBOPlayerDormieOnPress(round, game, playerId, latestPress, currentHole);
  if (!isDormieOnPress) {
    return { canPress: false, pressLevel: latestPress.pressLevel + 1, reason: 'Not dormie on current press' };
  }
  
  return { canPress: true, pressLevel: latestPress.pressLevel + 1 };
};
```

---

#### Step 4: Update ActiveRound Press Button UI

| File | Change |
|------|--------|
| `src/components/ActiveRound.tsx` | Update FBO Press UI to show double/triple press |

Change the dormie player filtering logic (around lines 1033-1037):

```typescript
// Find players who can press (first press or double press)
const pressEligiblePlayers = fboPlayers.filter(p => {
  const eligibility = getFBOPressEligibility(currentRound, fboGame, p.id, dormieStatus[p.id]?.segment || (activeHole <= 9 ? 'front' : 'back'), activeHole);
  return eligibility.canPress;
}).map(p => ({
  player: p,
  eligibility: getFBOPressEligibility(currentRound, fboGame, p.id, dormieStatus[p.id]?.segment || (activeHole <= 9 ? 'front' : 'back'), activeHole)
}));
```

Update the button label to show press level:

```typescript
<button
  onClick={() => handleFBOPress(fboGame.id, player.id, status.segment, eligibility.pressLevel)}
  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors"
>
  {eligibility.pressLevel === 1 ? 'Press' : 
   eligibility.pressLevel === 2 ? 'Double Press' : 
   `${eligibility.pressLevel}x Press`} (${fboGame.unitStake})
</button>
```

---

#### Step 5: Update Press Handler

| File | Change |
|------|--------|
| `src/components/ActiveRound.tsx` | Update `handleFBOPress` to include pressLevel |

```typescript
const handleFBOPress = (gameId: string, playerId: string, segment: 'front' | 'back', pressLevel: number = 1) => {
  const fboGame = currentRound.games.find(g => g.id === gameId);
  if (!fboGame) return;
  
  const newPress: FBOPressState = {
    playerId,
    segment,
    startHole: activeHole,
    unitValue: fboGame.unitStake,
    settled: false,
    pressLevel  // NEW
  };
  
  const fboGameData = currentRound.gameData?.[gameId] || {};
  const existingPresses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
  
  updateGameData(gameId, 1 as any, '_META_PRESSES' as any, [...existingPresses, newPress]);
  
  const player = currentRound.players.find(p => p.id === playerId);
  const pressLabel = pressLevel === 1 ? 'pressed' : 
                     pressLevel === 2 ? 'double pressed' : 
                     `${pressLevel}x pressed`;
  
  import('sonner').then(({ toast }) => {
    toast.success(`${player?.name} ${pressLabel} the ${segment === 'front' ? 'Front 9' : 'Back 9'}!`);
  });
};
```

---

#### Step 6: Update Scorecard Press Display

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Update press display to show level |

In the Presses section (around line 229):

```typescript
<span className="text-xs text-muted-foreground">
  {press.pressLevel === 1 ? 'pressed' : 
   press.pressLevel === 2 ? 'double pressed' : 
   `${press.pressLevel}x pressed`} {press.segment === 'front' ? 'Front' : 'Back'} on #{press.startHole}
</span>
```

---

#### Step 7: Calculation Engine Already Handles Multiple Presses

Looking at `calculateFBO` (lines 838-900), it already iterates through **all** presses and calculates each independently. No changes needed to the payout calculation.

---

### Summary of Files to Change

| File | Lines | Change |
|------|-------|--------|
| `src/types.ts` | 95-105 | Add `pressLevel: number` to `FBOPressState` |
| `src/services/gameEngine.ts` | After line 685 | Add `isFBOPlayerDormieOnPress` function |
| `src/services/gameEngine.ts` | After line 685 | Add `getFBOPressEligibility` function |
| `src/components/ActiveRound.tsx` | 319-346 | Update `handleFBOPress` to accept and store `pressLevel` |
| `src/components/ActiveRound.tsx` | 1033-1075 | Update FBO Press UI to use new eligibility check and show press level |
| `src/components/Scorecard.tsx` | ~229 | Update press display label to show level |

---

### Example Flow

1. **Hole 3**: Player A has 0 dots, leader has 3 dots. A is dormie (0 + 6 < 3 is false... wait, 0 + 6 = 6 > 3). Not dormie yet.

2. **Hole 5**: Player A has 0 dots, leader has 4 dots. A has 4 holes left (5,6,7,8,9). 0 + 4 = 4, which is not < 4. Not dormie.

3. **Hole 6**: Player A has 0 dots, leader has 5 dots. 0 + 4 = 4 < 5. Dormie! **First Press button appears**. A presses.

4. **Hole 8**: Since press started on hole 6, counting holes 6,7: A has 1 dot, leader has 2 dots in press range. A has 2 holes left (8,9). 1 + 2 = 3 >= 2. Not dormie on press.

5. **Hole 9**: A has 1 dot, leader has 3 dots in press range. 1 + 1 = 2 < 3. Dormie on press! **Double Press button appears**.

---

### Visual Representation

```text
Hole:     1  2  3  4  5  6  7  8  9
                         ↑
                      A Presses ($10)
                               ↑
                            A Double Presses ($10)

Payout at end of Front 9:
- Base segment: Whoever has most dots 1-9
- Press #1: Whoever has most dots 6-9
- Press #2: Whoever has most dots 9 only
```

