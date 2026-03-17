

# Make Betting Tab Fully Read-Only for Non-Owner Players

## Problem
The mutation handlers are guarded with `if (isReadOnly) return`, but the betting game UI still renders interactive buttons (Banker selection, multiplier buttons, FBO press buttons, Wolf selection, Stockton 6 dot toggles, Bloody Banker stake adjustments, Sixes press button). Users can tap them — they just silently fail. This is confusing.

## Approach
Hide or visually disable all interactive betting UI sections when `isReadOnly` is true. The status/display sections (P&L, point totals, team assignments) remain visible.

## Changes — Single File: `src/components/ActiveRound.tsx`

### 1. Banker Selection Panel (~line 1110-1171)
Wrap the entire banker game section's interactive parts: hide the player-selection buttons row and the "Banker Power" multiplier buttons when `isReadOnly`. Keep the header label and current banker name visible as a static display.

### 2. Bloody Banker "Down Player" Panel (~line 1173-1308)
Hide the multiplier buttons (Standard/Double/Triple/PreQuad) and the per-player stake adjustment buttons when `isReadOnly`. Keep the status display (who's down, by how much).

### 3. Wolf Game UI (~line 1311-1438)
Hide the entire unconfirmed selection panel (Blind Lone Wolf button, partner selection grid, Lone Wolf button) when `isReadOnly`. The confirmed state display (wolf team vs opponents) remains visible.

### 4. FBO Press UI — Both H2H and Pool modes (~line 1551-1971)
Hide the entire FBO press sections when `isReadOnly`. These are purely action-oriented (press/decline), not informational.

### 5. Sixes Status Bar press trigger (~line 1100-1107)
The `SixesStatusBar` receives an `onTriggerPress` callback. Pass a no-op or conditionally hide the press button. Since the handler is already guarded, simplest fix: pass `undefined` for `onTriggerPress` when `isReadOnly`.

### 6. Stockton 6 Dots Input (~line 1973-2065)
Hide the entire `Stockton6DotsInput` component when `isReadOnly` — the birdie/greenie toggle buttons are purely interactive.

### 7. Open Betting +/- buttons
Already checked — these are in the player cards. The `handleOpenBetChange` handler is guarded. Add `disabled` styling and `pointer-events-none` to the Open Betting +/- buttons when `isReadOnly`, matching how the score +/- buttons are handled.

## Summary
| Section | Action |
|---|---|
| Banker select buttons | Hide when `isReadOnly` |
| Banker multiplier buttons | Hide when `isReadOnly` |
| Bloody Banker multiplier + stake adj | Hide when `isReadOnly` |
| Wolf selection buttons | Hide when `isReadOnly` |
| FBO Press sections (H2H + Pool) | Hide when `isReadOnly` |
| Sixes press trigger | Pass no-op when `isReadOnly` |
| Stockton 6 dots | Hide when `isReadOnly` |
| Open Betting +/- | Add disabled styling when `isReadOnly` |

1 file modified, 0 new files, 0 database changes.

