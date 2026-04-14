

# Per-Game Player Selection + Banker Min Players Fix

## What changes

### 1. Add universal `gamePlayers` field to game config
Add `gamePlayers?: string[]` to `GameSettings.config` in `src/types.ts`. When set, only those players participate in that game. When unset, all round players participate (backward compatible).

### 2. Lower Banker minimum players from 3 to 2
In `src/lib/gameLibrary.ts`, change Banker and Bloody Banker `minPlayers` from 3 to 2.

### 3. Add player selection UI to GameSelector for all games
In `src/components/GameSelector.tsx`:
- For every selected game (not just FBO), show a "Players in [Game Name]" toggle section
- Default all players as selected when a game is first added
- Store selected player IDs in `config.gamePlayers`
- Validate minimum player count per game type
- FBO keeps its existing `fboPlayers` field but also syncs with `gamePlayers` for consistency
- Player count validation uses `gamePlayers.length` instead of `players.length` when `gamePlayers` is set

### 4. Update game engines to respect `gamePlayers`
In `src/services/gameEngine.ts`:
- For Banker/Bloody Banker/Skins/Nassau/Wolf/Nine Points/Open Betting: filter `round.players` to only `gamePlayers` when calculating results
- FBO already uses `fboPlayers` — keep that as-is, but also populate `gamePlayers` for consistency

## Files changed
- **`src/types.ts`** — add `gamePlayers?: string[]` to `GameSettings.config`
- **`src/lib/gameLibrary.ts`** — Banker/Bloody Banker `minPlayers: 2`
- **`src/components/GameSelector.tsx`** — add player selection UI for all games, validation logic
- **`src/services/gameEngine.ts`** — use `gamePlayers` to filter participating players in each game's calculations

## Technical detail
- `gamePlayers` validation: when toggling a game on, `gamePlayers` defaults to all player IDs. Users can then deselect players, but cannot go below the game's `minPlayers`.
- The existing `fboPlayers` stays as-is to avoid breaking existing rounds. New games use `gamePlayers`.
- Game engines add a helper: `getGamePlayers(game, round) => Player[]` that checks `gamePlayers` first, falls back to `round.players`.

