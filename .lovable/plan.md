

# Fix: Team Banker Net Score Calculation (Both Handicap Modes)

## Summary
Yes — the fix will respect whichever handicap mode the user chose during game setup. The `handicapMode` value (`'absolute'` = "Everyone gets a Stroke", `'relative'` = "Low man = 0") is already stored in `gameData` and read by the engine. The problem is that the current stroke formula (`calculateSixesStrokes`) disagrees with the Scorecard's formula (`calculateStrokesReceived`), producing wrong winners.

## What Changes

**File:** `src/services/teamBankerEngine.ts` — lines 163-166

Replace `calculateSixesStrokes` with `calculateStrokesReceived` (from `gameEngine.ts`), branching on the user's chosen mode:

- **"Everyone gets a Stroke" (absolute):** `calculateStrokesReceived(player.courseHandicap, hole.handicapIndex)` — handles multi-stroke holes correctly and cancels when all players get a stroke.
- **"Low man = 0" (relative):** `calculateStrokesReceived(player.courseHandicap - lowestCourseHandicap, hole.handicapIndex)` — lowest handicap player gets 0, others get strokes based on the difference.

This ensures the engine's winner determination matches the net scores shown on the Scorecard in both modes.

### Changes
1. Add import: `calculateStrokesReceived` from `gameEngine.ts`
2. Remove import: `calculateSixesStrokes` from `sixesEngine.ts`
3. Replace lines 163-166 with per-player stroke calculation using `calculateStrokesReceived`, branching on `handicapMode`
4. For absolute mode: add the "cancel all if everyone gets a stroke" logic (matching the existing absolute behavior)

One file, ~20 lines changed.

