

## Updated Plan: Enhanced Share Formats with Game Breakdown and Scorecard Image

### Overview
This plan addresses three components:
1. Update the Stockton 6's share format to match the Main Round Summary
2. Add per-game breakdown to the Main Round Summary share (when multiple games are played)
3. Add the ability to share the Main Player Scorecard as a landscape-optimized image

---

### Part 1: Align Stockton 6's Share Format

**File:** `src/components/stockton6/Stockton6RoundSummary.tsx`

**Current Format:**
```
🏌️ Stockton 6's Results
Course: Mountain View Golf Club

Player Results:
🥇 John: +$50
🥈 Mike: +$10
...
✓ Totals balanced
```

**New Format:**
```
🏌️ Mountain View Golf Club - Jan 27, 2026

John: +$50 (78 strokes)
Mike: +$10 (82 strokes)
...

Money Shot by F&Gs All Day
```

**Changes:**
- Import `formatMoney` from `@/services/gameEngine`
- Add `getPlayerTotalScore` helper to calculate total strokes
- Format date using `toLocaleDateString`
- Remove ranked medals, use simple sorted list
- Add branding footer

---

### Part 2: Add Per-Game Breakdown to Round Summary Share

**File:** `src/components/RoundSummary.tsx`

**Current Share Format:**
```
🏌️ Mountain View Golf Club - Jan 27, 2026

John: +$50 (78 strokes)
Mike: +$10 (82 strokes)
...

Money Shot by F&Gs All Day
```

**New Share Format (when multiple games):**
```
🏌️ Mountain View Golf Club - Jan 27, 2026

John: +$50 (78 strokes)
Mike: +$10 (82 strokes)
Sarah: -$20 (85 strokes)
Dave: -$40 (88 strokes)

Money Shot by F&Gs All Day

--- Games Breakdown ---
Banker ($5/unit):
  John: +$30 | Mike: +$10 | Sarah: -$15 | Dave: -$25

Skins ($10/unit):
  John: +$20 | Mike: $0 | Sarah: -$5 | Dave: -$15
```

**Implementation:**
1. Import `calculatePerGameTotals` from `@/services/gameEngine`
2. In `handleShare`, after building the main results:
   - Check if `currentRound.games.length > 1`
   - If multiple games, call `calculatePerGameTotals(currentRound)`
   - Build a "Games Breakdown" section showing each game name with unit stake and player results on one line

**Code Logic:**
```tsx
// After the main results block
let gameBreakdown = '';
if (currentRound.games.length > 1) {
  const perGameResults = calculatePerGameTotals(currentRound);
  
  gameBreakdown = '\n--- Games Breakdown ---';
  perGameResults.forEach(gameResult => {
    const game = currentRound.games.find(g => g.id === gameResult.gameId);
    if (!game) return;
    
    // Skip games with no activity
    const hasActivity = Object.values(gameResult.playerResults).some(v => v !== 0);
    if (!hasActivity) return;
    
    const playerLine = sortedPlayers
      .map(p => `${p.name}: ${formatMoney(gameResult.playerResults[p.id] || 0)}`)
      .join(' | ');
    
    gameBreakdown += `\n${game.name} ($${game.unitStake}/unit):\n  ${playerLine}`;
  });
}

const text = `🏌️ ${currentRound.course.name} - ${roundDate}\n\n${results}\n\nMoney Shot by F&Gs All Day${gameBreakdown}`;
```

---

### Part 3: Add Landscape Scorecard Image Sharing

**Step 1: Install html-to-image**

Add `html-to-image` package to `package.json`.

**Step 2: Update Scorecard Component**

**File:** `src/components/Scorecard.tsx`

**Scope:** Wrap **only** the Main Player Scorecard table with a `ref`. The following sections are excluded from the image:
- Banker Round Totals
- FBO Dots section
- FBO Segment Results
- Stockton 6's Dots section
- 6's Match Play section

**Implementation:**
1. Add `useRef` to capture the scorecard container
2. Import `toPng` from `html-to-image`
3. Create `handleShareImage` function:
   - Show loading toast
   - Capture scorecard as PNG with white background and 2x pixel ratio
   - Use `navigator.share` with file on mobile
   - Download fallback on desktop
4. Add "Share Image" button in footer

**Landscape Optimization:**
- The existing `inline-block min-w-full` styling on the scorecard table ensures the full 18-hole width is captured
- The high `pixelRatio: 2` ensures crisp rendering when viewed in landscape

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/stockton6/Stockton6RoundSummary.tsx` | Update `handleShare` to match RoundSummary format |
| `src/components/RoundSummary.tsx` | Import `calculatePerGameTotals`, add game breakdown section when multiple games |
| `src/components/Scorecard.tsx` | Add `useRef`, import `html-to-image`, wrap main scorecard with ref, add Share Image button |
| `package.json` | Add `html-to-image` dependency |

---

### Example Output: Multiple Games Share

```
🏌️ Pebble Beach Golf Links - Jan 27, 2026

John: +$85 (76 strokes)
Mike: +$15 (80 strokes)
Sarah: -$40 (84 strokes)
Dave: -$60 (88 strokes)

Money Shot by F&Gs All Day

--- Games Breakdown ---
Banker ($5/unit):
  John: +$45 | Mike: +$20 | Sarah: -$25 | Dave: -$40

6's or 3's ($10/unit):
  John: +$20 | Mike: -$10 | Sarah: +$10 | Dave: -$20

Skins ($5/unit):
  John: +$20 | Mike: +$5 | Sarah: -$25 | Dave: $0
```

---

### Technical Notes

**Game Name Display:**
- Uses `game.name` from the game settings (user-defined or library default)
- Unit stake shown in parentheses for context

**Conditional Breakdown:**
- Only appears when `games.length > 1`
- Games with no financial activity (all $0) are skipped
- Single-game rounds show only the main summary (no breakdown needed)

**Scorecard Image Capture:**
- Only captures the player scores table with course header
- Excludes supplemental game-specific sections to keep image clean and focused

