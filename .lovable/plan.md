

## Create Tournament Wizard — 4-Step Implementation

This replaces the current simple "Create Tournament" dialog in `TournamentList.tsx` with a full-page, multi-step wizard. No database schema changes needed — all new data fits in the existing `settings` jsonb column on `tournaments` and `tournament_players` table.

### Data Model (stored in `tournaments.settings` jsonb)

```text
settings: {
  description?: string,
  num_rounds: number,           // 1-7
  start_date?: string,          // ISO date
  end_date?: string,            // ISO date
  teams_enabled: boolean,
  teams?: [{ name: string, color: string, playerIds: string[] }],
  games: [{
    type: 'stroke_gross' | 'stroke_net' | 'stableford' | 'modified_stableford' |
          'team_stroke_gross' | 'team_stroke_net' | 'team_best_ball',
    name: string,
    config: {
      handicap_pct?: number,                    // for net games, default 100
      stableford_values?: {                     // only for modified_stableford
        eagle: number, birdie: number, par: number,
        bogey: number, double_bogey: number
      }
    }
  }],
  leaderboards: [{
    name: string,
    metric: string,             // matches game type or 'daily_points' | 'money_won'
    scope: 'individual' | 'team',
    sort: 'asc' | 'desc',
    show_rounds_breakdown: boolean
  }]
}
```

### Files to Create

1. **`src/pages/CreateTournamentWizard.tsx`** — Full-page 4-step wizard component
   - Step 1 (Basic Info): Name, description, num rounds stepper, date pickers, join code display with regenerate
   - Step 2 (Players): Pull from `useSavedPlayers` + search via `search_users_by_name` RPC. Editable handicap per player. Teams toggle with team builder (name + color + player assignment). Min 2 players validation.
   - Step 3 (Games): Card-based multi-select of the 7 game types. Group into "Individual" and "Team" sections. Team games only available when teams are enabled. Show config panel for Modified Stableford (custom point values) and net games (handicap %).
   - Step 4 (Leaderboards): Add up to 5 leaderboards. Each has name, metric dropdown (populated from selected games), scope, sort direction, show-rounds toggle. First leaderboard is marked as default. Pre-populate a sensible default leaderboard based on selected games.

2. **`src/services/tournamentScoringEngine.ts`** — Pure scoring functions (needed by leaderboard later but defining the types now)
   - `calculateStablefordPoints(gross, par, handicapStrokes)`
   - `calculateModifiedStablefordPoints(gross, par, handicapStrokes, values)`
   - Standard and modified stableford point tables
   - Type exports for game configs

### Files to Modify

3. **`src/pages/TournamentList.tsx`**
   - Remove the inline create dialog
   - "Create Tournament" button navigates to `/tournament/create`
   - Keep join flow as-is

4. **`src/hooks/useTournament.tsx`**
   - Update `createTournament` signature to accept full settings object (description, num_rounds, start_date, end_date, teams, games, leaderboards)
   - Add `addPlayers` batch method to insert multiple `tournament_players` rows at once
   - Add `regenerateJoinCode` method

5. **`src/App.tsx`**
   - Add route: `/tournament/create` → `CreateTournamentWizard`
   - Add import for `CreateTournamentWizard`

### Implementation Details

- **Join code**: The DB auto-generates via `generate_join_code()` on insert. The wizard shows it after creation. "Regenerate" updates the tournament row with a new code (call the function via a simple update).
- **Player search**: Reuse existing `search_users_by_name` RPC and `useSavedPlayers` hook. Players added in the wizard are inserted into `tournament_players` table after tournament creation.
- **Teams**: Stored in `settings.teams`. When teams are enabled, Step 2 shows a team builder where organizer creates team names/colors and assigns players via dropdown. Team game types in Step 3 are disabled if teams not enabled.
- **Leaderboards**: Stored in `settings.leaderboards`. The dashboard will later read these to render multiple leaderboard views. For now, just capture the config.
- **No DB migration needed** — all new data goes into the existing `settings` jsonb column and `tournament_players` rows.
- **Existing tournament creation** from the old dialog will continue to work since `settings` defaults to `{}`.

### Step Navigation UX
- Progress bar showing steps 1-4
- Back/Next buttons with validation per step
- Step 1: Name required
- Step 2: Min 2 players, teams validated if enabled
- Step 3: At least 1 game selected
- Step 4: At least 1 leaderboard
- Final "Create Tournament" button on Step 4

