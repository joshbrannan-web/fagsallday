

## Plan: Fix Crown Icon for Bloody Banker on Scorecard

### Problem
The crown icon only appears when a regular Banker game is active. It does not appear for Bloody Banker because the code specifically looks for `GameType.BANKER` and ignores `GameType.BLOODY_BANKER`.

---

### Solution
Update the banker detection logic to check for both game types.

---

### Technical Changes

**File:** `src/components/Scorecard.tsx`

**Current code (lines 289-295):**
```tsx
// Find banker game and get banker for each hole
const bankerGame = currentRound.games.find(g => g.type === GameType.BANKER);
const getBankerForHole = (holeNum: number): string | null => {
  if (!bankerGame) return null;
  const holeData = currentRound.gameData?.[bankerGame.id]?.[holeNum];
  return holeData?.bankerId || null;
};
```

**Updated code:**
```tsx
// Find banker games (both regular Banker and Bloody Banker) and get banker for each hole
const bankerGames = currentRound.games.filter(g => 
  g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER
);
const getBankerForHole = (holeNum: number): string | null => {
  for (const game of bankerGames) {
    const holeData = currentRound.gameData?.[game.id]?.[holeNum];
    if (holeData?.bankerId) return holeData.bankerId;
  }
  return null;
};
```

---

### How It Works

1. Instead of finding a single `bankerGame`, we now filter for all games that are either `BANKER` or `BLOODY_BANKER`
2. The `getBankerForHole` function iterates through all banker-style games and returns the first `bankerId` found
3. This ensures the crown appears regardless of which banker game type is active

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Update lines 289-295 to detect both Banker and Bloody Banker game types |

