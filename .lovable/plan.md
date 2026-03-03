

# Fix: Create Missing GameSelector.tsx

## Root Cause
The previous edit claimed to create `src/components/GameSelector.tsx` but the file doesn't exist on disk. Both `SetupWizard.tsx` and `TournamentBuildRoundWizard.tsx` import from it, causing the build to fail.

## Fix
1. **Read `SetupWizard.tsx`** to see what's being imported from `GameSelector` and what the component contract looks like
2. **Read `TournamentBuildRoundWizard.tsx`** to see how it imports/uses GameSelector
3. **Read `src/lib/gameLibrary.ts`** for the GAME_LIBRARY/GAME_DETAILS data
4. **Create `src/components/GameSelector.tsx`** with the full game selection UI extracted from the SetupWizard, matching the expected props interface

## Files
- **Create:** `src/components/GameSelector.tsx`

