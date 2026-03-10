

# Tournament Team Scoring Method Option

## What
Add a tournament-level setting that lets the creator choose how round results contribute to the overall team score:
- **Cumulative Points** (default, current behavior): every hole's points add up across all rounds
- **Round Win** (new): each completed round awards 1 point to the winning team (½ each if tied)

## Database Change
Add a column to `tournaments`:
```sql
ALTER TABLE tournaments ADD COLUMN team_scoring_method text NOT NULL DEFAULT 'cumulative';
```
No new RLS needed — existing tournament policies cover it.

## Files Changed

### 1. `src/components/tournament-admin/WizardStepBasicInfo.tsx`
- Add a "Team Scoring" selector with two options:
  - "Cumulative Points" — all match points add to team total
  - "Round Win (1pt)" — winning a round earns 1 team point
- Store as `teamScoringMethod` in the basicInfo state

### 2. `src/components/tournament-admin/CreateTournamentWizard.tsx`
- Pass `teamScoringMethod` through to `createTournament`

### 3. `src/hooks/useTournaments.ts`
- Add `teamScoringMethod` to `CreateTournamentData` interface
- Write it as `team_scoring_method` on tournament insert

### 4. `src/types/tournament.ts`
- Add `teamScoringMethod` field to the `Tournament` type

### 5. `src/components/scoreboards/RyderCupGraphic.tsx`
- Accept `teamScoringMethod` prop
- When `'round_win'`: instead of summing hole points, award 1pt per completed round to the team with higher total (½ each if tied)

### 6. `src/components/scoreboards/TeamPointsBreakdownTable.tsx`
- Same logic change for the per-round breakdown display

### 7. `src/hooks/useTournamentScoreboards.ts`
- Fetch `team_scoring_method` from tournament data and pass it through to scoreboard components

