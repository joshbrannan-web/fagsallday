

## Plan: Tournament Wizard UX Improvements

### Changes Overview

Four modifications to `src/pages/CreateTournamentWizard.tsx`:

### 1. End Date Calendar defaults to Start Date month
- Pass `defaultMonth={startDate}` to the end date `Calendar` component
- Also set `disabled` to prevent selecting dates before start date
- Lines ~341-343

### 2. Filter already-assigned players from other teams
- In the team builder (lines 468-483), when rendering player badges for a team, only show players who are either already in *this* team OR not assigned to *any* team
- Compute `assignedPlayerIds` (set of all player IDs in other teams) and filter accordingly

### 3. Round-by-Round Configuration (replaces current Step 3)
This is a significant restructure. Instead of selecting games at the tournament level, the wizard allows per-round configuration:

- Step 3 becomes **"Rounds & Games"**
- Show tabs/accordion for each round (1 through `numRounds`)
- For each round, organizer configures:
  - **Matchup format**: 1v1, 2v2, 4v4, or FFA (Free For All)
  - **Blind teams toggle**: if on, matchups are across groups not physically together
  - **Player groupings**: assign players into match groups based on format
  - **Games**: select scoring formats (same 7 game types) that apply to this round
  - Per-game config (handicap %, modified stableford values) same as current

- Data model update in `TournamentSettings`:
  ```text
  settings.games → removed (replaced by per-round)
  settings.rounds_config: [{
    round_number: number,
    matchup_format: '1v1' | '2v2' | '4v4' | 'ffa',
    blind_teams: boolean,
    matchups: [{ group_name: string, playerIds: string[] }],
    games: TournamentGameConfig[]
  }]
  ```

- Initialize `rounds_config` array with `numRounds` entries when entering Step 3
- Auto-populate default leaderboard from the union of all round games

- Update `handleCreate` to store `rounds_config` instead of `games` in settings
- Update leaderboard metric options to derive from all unique game types across rounds

### 4. Leaderboard: Scope first, then filtered Metrics
- Reorder the leaderboard config UI: Scope dropdown appears first (full width or left column)
- When scope is "Individual", metric dropdown only shows individual game types + daily_points + money_won
- When scope is "Team", metric dropdown only shows team game types + daily_points + money_won
- Filter `metricOptions` based on `lb.scope` using `GAME_TYPE_INFO[type].isTeam`

### Files to Modify
- `src/pages/CreateTournamentWizard.tsx` — all 4 changes
- `src/services/tournamentScoringEngine.ts` — update `TournamentSettings` type to include `rounds_config`

### Types addition in scoring engine:
```typescript
export interface RoundConfig {
  round_number: number;
  matchup_format: '1v1' | '2v2' | '4v4' | 'ffa';
  blind_teams: boolean;
  matchups: { group_name: string; playerIds: string[] }[];
  games: TournamentGameConfig[];
}

// Update TournamentSettings:
export interface TournamentSettings {
  // ... existing fields
  games: TournamentGameConfig[];        // keep for backward compat
  rounds_config?: RoundConfig[];        // new per-round config
  leaderboards: LeaderboardConfig[];
}
```

