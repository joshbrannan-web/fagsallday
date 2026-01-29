
## Plan: Persist Adjusted Money Totals + Verify Scorecard Image Sharing

This plan addresses two requirements:
1. **Save adjusted money amounts** - When users manually adjust player earnings on the Round Summary screen, those adjustments should persist when finishing the round
2. **Verify scorecard image sharing** - Confirm the share image function correctly captures and shares all 18 holes via text/SMS

---

## Part 1: Persist Adjusted Money Amounts

### Current Behavior
- Users can manually edit player money amounts on the Round Summary screen via tap-to-edit
- Adjustments are stored only in local React state (`adjustedAmounts`)
- When "Finish & Save" is clicked, these adjustments are lost because `finishRound()` doesn't save them

### Solution
Store the final adjusted amounts in the round's `gameData` under a special metadata key (`_FINAL_ADJUSTMENTS`) before calling `finishRound()`. When viewing past rounds, prioritize these saved adjustments over calculated totals.

---

### Changes Required

**File 1: `src/components/RoundSummary.tsx`**

1. Import `updateGameDataBatch` from `useApp()`
2. Update `handleFinish` to save adjustments before finishing
3. Update the initialization `useEffect` to load saved adjustments

```text
Line 102: Add updateGameDataBatch to destructured useApp() import
Line 107-116: Update useEffect to check for saved _FINAL_ADJUSTMENTS first
Line 157-161: Make handleFinish async and save adjustments before calling finishRound
```

**File 2: `src/services/gameEngine.ts`**

1. Update `calculateRoundTotals` to return saved adjustments if they exist

```text
Line 1280-1292: Add check for _FINAL_ADJUSTMENTS at the start of the function
```

---

### Detailed Code Changes

**RoundSummary.tsx - handleFinish (Lines 157-161)**

Before:
```tsx
const handleFinish = () => {
  finishRound();
  toast.success('Round saved to history!');
  navigate('/');
};
```

After:
```tsx
const handleFinish = async () => {
  // Save final adjusted amounts if any differ from calculated
  const hasAdjustments = currentRound.players.some(
    p => adjustedAmounts[p.id] !== roundTotals[p.id]
  );
  
  if (hasAdjustments) {
    await updateGameDataBatch('_META', 0, { _FINAL_ADJUSTMENTS: adjustedAmounts });
  }
  
  await finishRound();
  toast.success('Round saved to history!');
  navigate('/');
};
```

**RoundSummary.tsx - useEffect (Lines 107-116)**

Before:
```tsx
useEffect(() => {
  if (currentRound && Object.keys(adjustedAmounts).length === 0) {
    const initial: Record<string, number> = {};
    currentRound.players.forEach(p => {
      initial[p.id] = roundTotals[p.id] || 0;
    });
    setAdjustedAmounts(initial);
  }
}, [currentRound, roundTotals]);
```

After:
```tsx
useEffect(() => {
  if (currentRound && Object.keys(adjustedAmounts).length === 0) {
    // Check for saved final adjustments first
    const savedAdjustments = currentRound.gameData?._META?.[0]?._FINAL_ADJUSTMENTS;
    
    if (savedAdjustments && Object.keys(savedAdjustments).length > 0) {
      setAdjustedAmounts(savedAdjustments);
    } else {
      const initial: Record<string, number> = {};
      currentRound.players.forEach(p => {
        initial[p.id] = roundTotals[p.id] || 0;
      });
      setAdjustedAmounts(initial);
    }
  }
}, [currentRound, roundTotals]);
```

**gameEngine.ts - calculateRoundTotals (Lines 1280-1292)**

Before:
```tsx
export const calculateRoundTotals = (round: Round): { [playerId: string]: number } => {
  const totals: { [playerId: string]: number } = {};
  round.players.forEach((p) => (totals[p.id] = 0));

  const perGameResults = calculatePerGameTotals(round);
  // ...
};
```

After:
```tsx
export const calculateRoundTotals = (round: Round): { [playerId: string]: number } => {
  // Check for saved final adjustments first (user overrides)
  const savedAdjustments = round.gameData?._META?.[0]?._FINAL_ADJUSTMENTS;
  if (savedAdjustments && Object.keys(savedAdjustments).length > 0) {
    return savedAdjustments;
  }

  const totals: { [playerId: string]: number } = {};
  round.players.forEach((p) => (totals[p.id] = 0));

  const perGameResults = calculatePerGameTotals(round);
  // ...
};
```

---

## Part 2: Verify Scorecard Image Sharing

### Current Implementation Analysis

The scorecard image sharing in `src/components/Scorecard.tsx` is already correctly implemented:

1. **Hidden capture container** (Lines 836-933): A hidden `div` with `ref={scorecardRef}` positioned off-screen contains the full 18-hole table using `holes.map()` (all holes, not filtered by viewMode)

2. **Image generation** (Lines 266-300): Uses `html-to-image` library with `pixelRatio: 2` for high quality

3. **Native sharing** (Lines 283-295): Correctly uses `navigator.share` with file sharing capability for mobile devices

4. **Content includes**:
   - Course name and date header
   - All 18 holes with par and handicap index
   - Player scores with color coding
   - Stroke dots and banker crown indicators
   - Per-hole P&L and total financial outcomes

### Verification Status

The implementation looks correct. The hidden div correctly maps through all `holes` (18 holes) rather than `activeHoles` (filtered by viewMode). The share function properly:
- Generates a PNG blob from the hidden full-scorecard container
- Uses `navigator.share({ files: [file] })` for native mobile sharing
- Falls back to direct download on desktop

### Recommendation
Test the feature end-to-end on a mobile device to confirm the generated image includes all 18 holes and can be shared via text message successfully.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/RoundSummary.tsx` | Add `updateGameDataBatch` import; save adjustments in `handleFinish`; load saved adjustments in `useEffect` |
| `src/services/gameEngine.ts` | Check for `_FINAL_ADJUSTMENTS` at start of `calculateRoundTotals` |

---

## Data Storage Structure

Adjustments stored at a reserved location to avoid conflicts:

```json
{
  "_META": {
    "0": {
      "_FINAL_ADJUSTMENTS": {
        "player-id-1": 85,
        "player-id-2": 15,
        "player-id-3": -40,
        "player-id-4": -60
      }
    }
  },
  "banker-game-id": { ... },
  "fbo-game-id": { ... }
}
```

This uses hole `0` (which doesn't exist in golf) under a `_META` game ID to ensure no conflicts with real game data.
