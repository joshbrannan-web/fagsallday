

# Fix #40: Extract GameSelector Component

## Problem
Tournament wizard Step 6 has a simplified game selection UI (just Switch toggles + basic Input stakes) instead of the full-featured game selection from SetupWizard (which includes FBO player selection, handicap mode radio groups, Wolf tee order, Banker multipliers, Skins carryovers, Team Banker rotation, head-to-head matchups, etc.).

## Plan

### 1. Create `src/components/GameSelector.tsx`

A standalone component that receives:
```ts
interface GameSelectorProps {
  players: Player[];
  selectedGames: GameSettings[];
  onGamesChange: (games: GameSettings[]) => void;
}
```

Extract the full game selection rendering from SetupWizard lines 1725-2444 into this component. Include the three handler functions (`handleToggleGame`, `handleUpdateGameStake`, `handleUpdateGameConfig`) as internal logic that calls `onGamesChange`. The component renders the complete game cards with all configuration panels (FBO players + presses + head-to-head matchups, Skins carryovers, handicap mode radio groups, Wolf tee order, Banker/Bloody Banker/Team Banker multipliers + rotation mode + 2nd ball tiebreaker).

### 2. Update `src/components/SetupWizard.tsx`

Replace the inline game selection rendering (lines 1725-2444) with:
```tsx
<GameSelector
  players={players.filter(p => p.name.trim())}
  selectedGames={selectedGames}
  onGamesChange={setSelectedGames}
/>
```

Remove the three handler functions (`handleToggleGame`, `handleUpdateGameStake`, `handleUpdateGameConfig`) since they move into GameSelector.

### 3. Update `src/components/tournament/TournamentBuildRoundWizard.tsx`

Replace the current `renderStep6()` implementation (lines 222-306) with the GameSelector component. Map tournament players to the `Player` type and wire `onGamesChange` to `setup.setSideGames`.

### Files
- **Create:** `src/components/GameSelector.tsx`
- **Modify:** `src/components/SetupWizard.tsx` (replace inline game UI with GameSelector)
- **Modify:** `src/components/tournament/TournamentBuildRoundWizard.tsx` (replace Step 6 with GameSelector)

