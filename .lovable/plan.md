

## Block Next-Hole Navigation Until All Scores Are Entered

### What changes

When a user taps the "next hole" arrow (or the finish flag on hole 18), the app will check if every player has a score entered for the current hole. If not, it will:
1. Show a toast message: "Enter scores for all players before moving on"
2. Scroll to the first player card that still needs a score

Going to the **previous** hole will remain unrestricted.

### Technical details

**File: `src/components/ActiveRound.tsx`**

1. **Add a ref map for player cards** -- Create a `playerCardRefs` object (using `useRef<Record<string, HTMLDivElement | null>>`) to track each player's score card DOM element. Attach a ref to each player card div inside the `currentRound.players.map(...)` block (around line 1610).

2. **Create a `canAdvanceHole()` helper function** -- Defined inside the component, this checks if all players have a valid numeric score for `activeHole`:
   ```typescript
   const canAdvanceHole = (): boolean => {
     return currentRound.players.every(p => {
       const score = currentRound.scores[activeHole]?.[p.id];
       return typeof score === 'number' && score > 0;
     });
   };
   ```

3. **Create a `handleNextHole()` function** -- Replaces the inline `setActiveHole(h => h + 1)` and the `navigate('/summary')` calls:
   ```typescript
   const handleNextHole = () => {
     if (!canAdvanceHole()) {
       // Find first player missing a score
       const missingPlayer = currentRound.players.find(p => {
         const score = currentRound.scores[activeHole]?.[p.id];
         return !(typeof score === 'number' && score > 0);
       });
       if (missingPlayer) {
         playerCardRefs.current[missingPlayer.id]?.scrollIntoView({ 
           behavior: 'smooth', block: 'center' 
         });
       }
       toast.error('Enter scores for all players before moving on');
       return;
     }
     if (activeHole === 18) {
       navigate('/summary');
     } else {
       setActiveHole(h => h + 1);
     }
   };
   ```

4. **Update navigation buttons (lines 607-621)** -- Replace both the hole-18 finish button's `onClick` and the next-hole button's `onClick` to call `handleNextHole()` instead of their current inline handlers.

5. **Add `ref` to player card divs (around line 1610)** -- Attach `ref={el => { playerCardRefs.current[p.id] = el; }}` to each player's outermost card div.

### Files to modify
- `src/components/ActiveRound.tsx` (single file change)
