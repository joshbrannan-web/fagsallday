

# Restrict Side Games in Tournament Mode

## Problem
In tournament mode, team-rotating games (6's/3's, Stockton 6's) conflict with fixed tournament team assignments. Team Banker's 6-hole and 3-hole rotation modes also break tournament scoring. These need to be blocked when selecting side games in the tournament wizard.

## Changes

### 1. `src/components/GameSelector.tsx`
- Add optional `isTournamentMode?: boolean` prop
- Filter `GAME_LIBRARY` to exclude `SIXES`, `STOCKTON_6`, and `TEAM_BANKER` types when `isTournamentMode` is true... actually Team Banker should still be allowed but forced to 18-hole mode only
- Revised: exclude `SIXES` and `STOCKTON_6` entirely; keep `TEAM_BANKER` but when `isTournamentMode`, force its rotation mode to `'eighteen'` and hide the rotation mode selector

### 2. `src/components/tournament/TournamentBuildRoundWizard.tsx`
- Pass `isTournamentMode` to `<GameSelector>`

### Implementation detail

In `GameSelector`, filter the game list:
```ts
const availableGames = isTournamentMode
  ? GAME_LIBRARY.filter(g => g.type !== GameType.SIXES && g.type !== GameType.STOCKTON_6)
  : GAME_LIBRARY;
```

For Team Banker in tournament mode: when toggling it on, force `teamBanker.mode` to `'eighteen'`. In the config UI, hide the rotation mode radio group when `isTournamentMode`.

