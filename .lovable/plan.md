

# Add Game Results & Betting to Public Round View

## What changes

### 1. Edge function: include game data in response
In `supabase/functions/get-public-round/index.ts`, add `games_data` and `game_data` to the SELECT query, and return them as `games` and `gameData` in the response payload.

### 2. ViewRound page: render game results and settlement
In `src/pages/ViewRound.tsx`:
- Expand the `PublicRoundData` interface to include `games` (array of `GameSettings`) and `gameData`
- Import `calculatePerGameTotals`, `calculateRoundTotals`, `formatMoney`, and `calculateSettlement` from the game engine
- Reconstruct a minimal `Round` object from the public data to pass to the calculation functions
- After the scorecard cards, render:
  - **Per-game breakdown cards** — each game showing player payouts (green for positive, red for negative)
  - **Overall totals card** — net position for each player
  - **Who Pays Who card** — settlement transactions

### Files changed
- **`supabase/functions/get-public-round/index.ts`** — add `games_data`, `game_data` to query and response
- **`src/pages/ViewRound.tsx`** — import game engine utilities, build Round object, render game results cards

