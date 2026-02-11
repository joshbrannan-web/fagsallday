

## New Game: Team Banker

A new 2v2 team game that combines Banker-style multiplier betting with 6's-style team rotation. No single "Banker" per hole -- instead, each of the 4 players independently chooses a multiplier (Double, Triple, Pre Quad, or pass) on each hole, and all multipliers compound together to determine the final bet. The team with the best net score wins.

---

### Game Rules Summary

- **4 players, split into 2 teams of 2**
- **Rotation modes**: 18 holes (same teams all round), 6-hole stretches (3 rotations), or 3-hole stretches (6 rotations) -- uses identical rotation logic to 6's/3's
- **Base bet**: $3/player (default), adjustable in $1 increments
- **Each hole**: All 4 players independently choose a multiplier (1x = pass, 2x = Double, 3x = Triple, 4x = Pre Quad). Multipliers compound together, e.g., Player A doubles (2x), Player B triples (6x), Player C doubles (12x) -- final payout per player = base x 12
- **Hole winner**: Compare Team A's lowest net score vs Team B's lowest net score (1st ball). If tied and 2nd Ball Tiebreaker is ON, compare the teams' higher net scores. If still tied (or tiebreaker OFF), the hole is a push
- **Winning team**: Each player on the winning team wins the final payout amount; each player on the losing team loses that amount
- **Handicaps**: Configurable (On/Off, Absolute/Relative mode) -- same options as Banker
- **Birdie/Eagle multipliers**: Configurable (same as Banker) -- applied to the winning team's best gross score relative to par
- **Settings persist** from stretch 1, just like 6's

---

### Technical Plan

#### 1. Add `TEAM_BANKER` to GameType enum
**File: `src/types.ts`**
- Add `TEAM_BANKER = 'TEAM_BANKER'` to the `GameType` enum
- Add a `teamBanker` config section to `GameSettings.config`:
  ```typescript
  teamBanker?: {
    mode: 'eighteen' | 'sixes' | 'threes'; // team rotation frequency
    useSecondBallTiebreaker: boolean;
  };
  ```

#### 2. Add Team Banker to the Game Library
**File: `src/components/SetupWizard.tsx`**
- Add a new entry to `GAME_LIBRARY`:
  - Type: `TEAM_BANKER`
  - Name: "Team Banker"
  - Icon: a suitable emoji (e.g., "🏦" with team twist or "👥🏦")
  - Default unit stake: $3, increment: $1
  - Min/max players: 4/4
  - Default config: `useHandicaps: true, handicapMode: 'relative', birdieMultiplier: 3, eagleMultiplier: 5, teamBanker: { mode: 'sixes', useSecondBallTiebreaker: false }`

#### 3. Setup Wizard -- Step 3 (Game Config)
**File: `src/components/SetupWizard.tsx`**
- When TEAM_BANKER is selected, show:
  - Unit stake ($3 default, $1 +/- buttons)
  - Use Handicaps toggle
  - Handicap Mode (Absolute/Relative) -- only when handicaps ON
  - Birdie Multiplier selector (None/Double/Triple)
  - Eagle Multiplier selector (None/Triple/Quintuple)
  - Rotation Mode selector: "18 Holes" / "6-Hole Stretches" / "3-Hole Stretches"
  - 2nd Ball Tiebreaker toggle
- Reuse existing Banker config UI components where possible

#### 4. Setup Wizard -- Step 4 (Team Setup)
**File: `src/components/SetupWizard.tsx` + new component `src/components/teamBanker/TeamBankerTeamSetup.tsx`**
- Show team selection UI (same style as 6's/Stockton 6's)
- Store initial team assignment in `gameData[gameId][1]` metadata, including all settings (unit value, mode, tiebreaker, handicap settings, multipliers)
- For "18 holes" mode, no rotation occurs

#### 5. Create Team Banker Engine
**File: `src/services/teamBankerEngine.ts`** (new file)
- Helper functions:
  - `isTeamBankerStretchStartHole(hole, mode)` -- determines if team setup should appear
  - `getTeamBankerStretchForHole(hole, mode)` -- returns current stretch number
  - `getTeamBankerTeamAssignment(gameData, gameId, stretch, mode)` -- retrieves team assignment
  - `getTeamBankerMode(gameData, gameId)` -- returns 'eighteen' / 'sixes' / 'threes'
- Reuse the rotation logic from 6's engine (`getRotatedTeams` pattern)

#### 6. Create Team Banker Calculation Engine
**File: `src/services/gameEngine.ts`**
- Add `calculateTeamBanker(round, game): GameResult`
  - For each hole:
    1. Get team assignment for current stretch
    2. Read each player's multiplier from `gameData[gameId][holeNumber][playerId]` (default 1)
    3. Compound all 4 multipliers together: `finalMultiplier = p1Mult * p2Mult * p3Mult * p4Mult`
    4. Calculate net scores (using game handicap config)
    5. Compare Team A best net vs Team B best net (1st ball)
    6. If tied and 2nd ball tiebreaker ON, compare 2nd balls
    7. Apply birdie/eagle multipliers to the final bet if applicable
    8. Payout = `unitStake * finalMultiplier * birdieOrEagleMultiplier`
    9. Each winning team player gets +payout, each losing team player gets -payout

#### 7. ActiveRound UI -- Team Setup Screens
**File: `src/components/ActiveRound.tsx`**
- Add `teamBankerNeedsSetup` memo (same pattern as `sixesNeedsSetup`)
- When a stretch start hole is reached, show the Team Banker team setup component
- For "18 holes" mode, only show at hole 1

#### 8. ActiveRound UI -- Per-Hole Multiplier Selection
**File: `src/components/ActiveRound.tsx`**
- For each player's score card on a hole with Team Banker active:
  - Show a multiplier dropdown (same style as existing Banker per-player multiplier)
  - Options: 1x (Pass), 2x (Double), 3x (Triple), 4x (Pre Quad)
  - Store selection in `gameData[gameId][holeNumber][playerId]`
- Show the running compound multiplier at the top (e.g., "Current Bet: $48/player")

#### 9. ActiveRound UI -- Team Colors
**File: `src/components/ActiveRound.tsx`**
- Extend `getPlayerTeamColor()` to also check for `TEAM_BANKER` game type
- Players get Team A (primary) or Team B (destructive) color coding

#### 10. Round Summary and Scorecard
**Files: `src/components/RoundSummary.tsx`, `src/components/Scorecard.tsx`**
- Add Team Banker to the game result calculations (call `calculateTeamBanker`)
- Display per-hole and total P&L like other games
- Show game config (mode, handicaps, multipliers, tiebreaker) in the "Games Played" section

#### 11. GameRoundTotals (Live Bets Bar)
**File: `src/components/GameRoundTotals.tsx`**
- Add TEAM_BANKER to `getGameDisplayName()` mapping
- Include Team Banker P&L in the expanded breakdown

---

### Files to create
- `src/components/teamBanker/TeamBankerTeamSetup.tsx` -- Team setup component
- `src/components/teamBanker/index.ts` -- Barrel export
- `src/services/teamBankerEngine.ts` -- Stretch/rotation/team logic

### Files to modify
- `src/types.ts` -- Add TEAM_BANKER enum + config type
- `src/components/SetupWizard.tsx` -- Game library entry + Step 3 config + Step 4 team setup
- `src/components/TeamSetupStep.tsx` -- Handle TEAM_BANKER in Step 4 routing
- `src/services/gameEngine.ts` -- Add `calculateTeamBanker` + wire into `calculatePerGameTotals`
- `src/components/ActiveRound.tsx` -- Team setup trigger, multiplier UI, team colors
- `src/components/RoundSummary.tsx` -- Include Team Banker results
- `src/components/Scorecard.tsx` -- Include Team Banker in scorecard display
- `src/components/GameRoundTotals.tsx` -- Display name + P&L row

