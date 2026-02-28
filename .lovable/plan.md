

## Plan: Add "Change Games" Button on Round Summary (Early Round Only)

### Condition
Show a "Change Games" button only when the round is `ACTIVE` and hole 2 is not yet complete (i.e., at most hole 1 has scores entered). This means fewer than 2 holes have all players scored.

### Changes

**1. Add `changeGames` function to AppContext and App.tsx**

- **`src/contexts/AppContext.tsx`**: Add `changeGames: (newGames: GameSettings[], initialGameData?: Record<string, any>) => void` to the `AppState` interface.
- **`src/App.tsx`**: Implement `changeGames` — it replaces `games`, resets `scores` to `{}`, resets `gameData` to `initialGameData || {}`, keeps `course` and `players` intact. Persists via `updateRound` (authenticated) or `setLocalCurrentRound` (local).

**2. Add "Change Games" button to RoundSummary**

- **`src/components/RoundSummary.tsx`**:
  - Compute `completedHoleCount` — number of holes where all players have a score > 0.
  - Show the button when `currentRound.status === 'ACTIVE' && completedHoleCount < 2`.
  - On click, navigate to `/setup` with state `{ changeGamesMode: true, existingCourse: currentRound.course, existingPlayers: currentRound.players }`.
  - Import `RefreshCw` icon from lucide-react for the button.

**3. Handle "Change Games" mode in SetupWizard**

- **`src/components/SetupWizard.tsx`**:
  - Read `location.state` for `changeGamesMode`, `existingCourse`, `existingPlayers`.
  - When `changeGamesMode` is true, skip directly to step 3 (game selection), pre-populate `selectedCourse`/`holes` and `players` from the passed state.
  - On "Start Round" (step 4 / final confirmation), instead of calling `startNewRound`, call `changeGames(selectedGames, initialGameData)` and navigate to `/active`.
  - The `changeGames` call resets scores and gameData while keeping the same round ID, course, and players.

### Files to modify
- `src/contexts/AppContext.tsx` — add `changeGames` to interface
- `src/App.tsx` — implement `changeGames`
- `src/components/RoundSummary.tsx` — add button with condition
- `src/components/SetupWizard.tsx` — handle change-games flow

