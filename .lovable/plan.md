

# Fix: Show Handicap Strokes on Scorecard for All Games

## Problem
The Scorecard only displays handicap stroke dots for manual overrides and Stockton 6's. For other games (Banker, FBO, Sixes, Nine Points, Skins, Nassau, etc.), even when handicaps are enabled, no stroke indicators appear on the scorecard. The ActiveRound scoring view correctly calculates strokes for all games, but the Scorecard doesn't replicate that logic.

## Solution
Update the stroke calculation in the Scorecard to mirror the ActiveRound logic, using the existing `calculateGameStrokes` and `calculateBankerMatchupStrokes` functions from `gameEngine.ts`.

## Changes

### `src/components/Scorecard.tsx`

**1. Add imports** — Import `calculateGameStrokes` and `calculateBankerMatchupStrokes` from `gameEngine.ts`.

**2. Update stroke dot logic (lines 951-956)** — Replace the current narrow check with the same priority logic used in ActiveRound:
- Manual strokes (already checked)
- Stockton 6's relative strokes (already checked)
- Banker games: use `calculateBankerMatchupStrokes` with the banker for that hole (relative mode) or absolute mode check
- All other games (FBO, Skins, Nassau, Nine Points, etc.): use `calculateGameStrokes` with the first applicable game's handicap config

This ensures the stroke dot on each score cell accurately reflects whether the player receives a handicap stroke on that hole, matching what the scoring engine uses for P&L calculations.

**1 file changed, no new dependencies.**

