

## Add Birdie Double (2x) Option to Banker Games

### Summary
Add a "Double (2x)" option to the Birdie Multiplier radio group in the Banker/Bloody Banker game setup. No calculation engine changes are needed -- the engine already supports any numeric multiplier value.

### Changes

**File: `src/components/SetupWizard.tsx`**
- Add a new RadioGroupItem with `value="2"` and label "Double (2x)" between the existing "None" (1) and "Triple (3x)" (3) options in the Birdie Multiplier radio group

**File: `src/types.ts`**
- Update the comment on `birdieMultiplier` from `// 1 = none, 3 = triple` to `// 1 = none, 2 = double, 3 = triple`

### Why No Engine Changes Are Needed
The game engine (`gameEngine.ts`) already uses the numeric `birdieMultiplier` value directly in its calculations (e.g., `bankerBaseMultiplier *= birdieMultiplier`). Setting it to `2` will automatically apply a 2x payout on birdies. The Round Summary display also already reads the numeric value dynamically (`Birdie: 2x`).

