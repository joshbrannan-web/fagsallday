

## Plan: Audit and Fix Press Logic for 6's and FBO Games

### Overview
This plan addresses issues with the Press functionality in both 6's and FBO games:
1. Fix press button availability logic to prevent showing when not applicable
2. Add FBO press indicator on the Scorecard
3. Verify dollar amounts flow correctly through calculations

---

### Part 1: Fix Press Button Availability Logic

#### Issue 1A: FBO - Don't Show Press Button When Not Actually Dormie

**Problem**: The `getFBODormieStatus` function counts dots only for holes *before* the current hole. When all dots are 0, the dormie check `playerDots + holesRemaining < leaderDots` becomes `0 + N < 0`, which is always false. However, the UI still shows the button incorrectly in some edge cases.

**Also**: When a player already has an active press for this segment, they should not see another press button unless they are dormie *on the press bet itself*.

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Update `hasExistingFBOPress` to check if player is dormie on the press bet itself |
| `src/components/ActiveRound.tsx` | No change needed - it correctly uses `hasExistingFBOPress` |

**Technical Detail - `hasExistingFBOPress` (lines 668-682)**:
Current logic:
```typescript
return presses.some(p => 
  p.playerId === playerId && 
  p.segment === segment && 
  p.startHole >= afterHole  // BUG: should be <= not >=
);
```
This checks if a press exists starting at or *after* the current hole, but it should check for any press in the *same segment* that hasn't completed. The logic should be:
```typescript
return presses.some(p => 
  String(p.playerId) === String(playerId) && 
  p.segment === segment
);
```
A player can only have one press per segment since pressing creates a bet from that hole to segment end.

---

#### Issue 1B: 6's - Don't Show Press Button When Press Already Active

**Problem**: The current logic in `hasExistingSixesPress` prevents a new press if any press by that team started at or before the current hole. This is correct for preventing duplicate presses but doesn't account for "press-the-press" scenarios.

**Clarification Needed**: Based on the memory context, presses in 6's create a side bet for the remaining holes. A team should only be able to press once per stretch unless implementing "press-the-press" (pressing the press bet when dormie on it).

**Current implementation is likely correct** - one press per team per stretch. No code change needed unless press-the-press is desired.

| File | Change |
|------|--------|
| `src/services/sixesEngine.ts` | Verify logic is correct (it is) |

---

### Part 2: Add FBO Press Indicator on Scorecard

**Problem**: The Scorecard shows FBO presses only in the "FBOSegmentResults" Presses list section. Unlike Stockton 6's (which has a "Press" row showing 1B/2B on specific holes), FBO has no inline indicator.

**Solution**: Add a "Press" row below the FBO Dots table showing which holes had presses triggered.

| File | Change |
|------|--------|
| `src/components/Scorecard.tsx` | Add a Press row to the FBO Dots table section |

**Technical Detail**:
After the FBO Dots `</table>` (around line 609), add a new row or section that:
1. Reads `_META_PRESSES` from the FBO gameData
2. For each hole in the current view (Front/Back), check if any press started on that hole
3. Display the player's initial/name who pressed

```tsx
{/* FBO Presses Row Indicator */}
{(() => {
  const fboGameData = currentRound.gameData?.[fboGame.id] as { _META_PRESSES?: FBOPressState[] } | undefined;
  const presses: FBOPressState[] = fboGameData?._META_PRESSES || [];
  
  if (presses.length === 0) return null;
  
  return (
    <tr className="bg-amber-500/5 border-t border-amber-500/20">
      <td className="p-3 text-left font-semibold sticky left-0 bg-amber-500/5 border-r border-border z-10 text-amber-600">
        Press
      </td>
      {activeHoles.map(h => {
        const pressOnHole = presses.find(p => p.startHole === h.number);
        if (!pressOnHole) {
          return <td key={h.number} className="p-2 border-r border-border/50">-</td>;
        }
        const player = fboPlayers.find(p => p.id === String(pressOnHole.playerId));
        return (
          <td key={h.number} className="p-2 border-r border-border/50">
            <span className="text-xs font-bold text-amber-500">
              {player?.name?.charAt(0) || 'P'}
            </span>
          </td>
        );
      })}
      <td className="p-2 font-bold text-foreground">-</td>
      <td className="p-2 font-bold bg-primary/5">-</td>
    </tr>
  );
})()}
```

---

### Part 3: Verify Press Payouts Flow Correctly

**Current Flow Analysis**:

1. **6's Presses**:
   - Stored in `gameData[gameId][stretchStartHole]._META_PRESSES`
   - Calculated by `calculateSixesPressPayouts()` (sixesEngine.ts:301-358)
   - Added to totals in `calculateSixes()` (sixesEngine.ts:388-398)
   - `calculateRoundTotals()` calls `calculateSixes()` ✓

2. **FBO Presses**:
   - Stored in `gameData[gameId]._META_PRESSES` (at hole 1 level)
   - Calculated in `calculateFBO()` (gameEngine.ts:835-899)
   - `calculateRoundTotals()` calls `calculateFBO()` ✓

**Issue Found in FBO Press Storage**:
In `handleFBOPress` (ActiveRound.tsx:339):
```typescript
updateGameData(gameId, 1 as any, '_META_PRESSES' as any, [...existingPresses, newPress]);
```
The presses are stored at `gameData[gameId][1]._META_PRESSES`.

But in `calculateFBO` (gameEngine.ts:831-832):
```typescript
const gameData = round.gameData?.[game.id] as { _META_PRESSES?: FBOPressState[] } | undefined;
const presses: FBOPressState[] = gameData?._META_PRESSES || [];
```
This reads from `gameData[gameId]._META_PRESSES` (root level), **not** `gameData[gameId][1]._META_PRESSES`.

**This is a bug!** The presses are being stored but not read correctly.

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Fix FBO press reading to look at `gameData[gameId][1]._META_PRESSES` |

**Technical Fix** (around line 831):
```typescript
// Current (broken):
const gameData = round.gameData?.[game.id] as { _META_PRESSES?: FBOPressState[] } | undefined;
const presses: FBOPressState[] = gameData?._META_PRESSES || [];

// Fixed:
const fboGameData = round.gameData?.[game.id] || {};
const pressesFromHole1 = fboGameData[1]?._META_PRESSES || [];
const presses: FBOPressState[] = pressesFromHole1;
```

Also update `FBOSegmentResults` component (Scorecard.tsx:166-167) to read from the correct location:
```typescript
// Current:
const fboGameData = gameData?.[fboGame.id] as { _META_PRESSES?: FBOPressState[] } | undefined;

// Fixed:
const fboGameData = gameData?.[fboGame.id];
const presses: FBOPressState[] = fboGameData?.[1]?._META_PRESSES || [];
```

---

### Part 4: Fix `hasExistingFBOPress` Logic Bug

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Fix the function to check correct data path |

Current implementation reads from wrong location. Also normalize player IDs:

```typescript
export const hasExistingFBOPress = (
  round: Round,
  gameId: string,
  playerId: string,
  segment: 'front' | 'back',
  afterHole: number
): boolean => {
  // Fix: Read from hole 1 where presses are stored
  const presses: FBOPressState[] = round.gameData?.[gameId]?.[1]?._META_PRESSES || [];
  
  // A player can only have one press per segment
  return presses.some(p => 
    String(p.playerId) === String(playerId) && 
    p.segment === segment
  );
};
```

---

### Summary of Changes

| File | Lines | Change Type |
|------|-------|-------------|
| `src/services/gameEngine.ts` | ~668-682 | Fix `hasExistingFBOPress` to read from correct path and simplify logic |
| `src/services/gameEngine.ts` | ~831-832 | Fix FBO press reading in `calculateFBO` |
| `src/components/Scorecard.tsx` | ~166-167 | Fix press reading in `FBOSegmentResults` |
| `src/components/Scorecard.tsx` | ~607 (after FBO table) | Add Press row indicator to FBO Dots section |

---

### Testing Checklist

1. **FBO Press Button**:
   - Press button should NOT appear on holes 1 and 10 (segment start)
   - Press button should appear when player is dormie (mathematically eliminated)
   - Press button should NOT appear if player already pressed this segment
   
2. **6's Press Button**:
   - Press button should appear when team is dormie
   - Press button should NOT appear if team already pressed this stretch

3. **Payouts**:
   - After fixing the data path, FBO presses should correctly add to round totals
   - Verify both winning and losing press scenarios

4. **Scorecard Display**:
   - FBO Dots section should show a "Press" row with player initials on holes where presses were triggered

