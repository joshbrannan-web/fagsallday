

# Plan: Five Tournament Enhancements

## 1. Custom Pts per Round — Team Scoring Option

Add a third team scoring method `custom_pts_per_round` where the admin sets how many points a round win is worth.

**Changes:**
- **DB migration**: ALTER `tournaments.team_scoring_method` to allow `'custom_pts_per_round'`. Add column `custom_round_points numeric default 3` to `tournaments`.
- **`src/types/tournament.ts`**: Extend `teamScoringMethod` union to include `'custom_pts_per_round'`. Add `customRoundPoints?: number` to `Tournament`.
- **`src/components/tournament-admin/WizardStepBasicInfo.tsx`**: Add third `SelectItem` for `custom_pts_per_round`. Show numeric input for points value when selected (default 3). Update `BasicInfoData` interface.
- **`src/components/tournament-admin/CreateTournamentWizard.tsx`**: Add `customRoundPoints` to state, pass to `createTournament`.
- **`src/hooks/useTournaments.ts`**: Map `customRoundPoints` in create and read.
- **`src/components/scoreboards/RyderCupGraphic.tsx`** + **`TeamPointsBreakdownTable.tsx`**: Handle `custom_pts_per_round` similar to `round_win` but use the custom point value instead of 1.
- **`src/hooks/useTournamentScoreboards.ts`**: Fetch and expose `custom_round_points`.

## 2. Show 2nd Ball Tiebreaker On/Off with Best Ball 2v2

Anywhere Best Ball 2v2 game type is displayed, append "(2nd Ball: On/Off)".

**Changes:**
- **`src/components/tournament/TournamentRoundCard.tsx`**: Accept `secondBallTiebreaker` prop. When `gameType === 'match_play_best_ball'`, append `• 2nd Ball: On/Off` to the label.
- **`src/components/tournament-admin/WizardStepReview.tsx`**: Show 2nd ball tiebreaker status for `match_play_best_ball` rounds.
- **`src/components/tournament/TournamentBuildRoundWizard.tsx`**: Where game type is shown during build, include 2nd ball status.
- **`src/pages/TournamentScoreboards.tsx`** (new rounds section — see item 3): Include 2nd ball status.

## 3. Tournament Detail Page — Show Rounds, Games, Groups & Pairings

When a player clicks "View Tournament", show rounds/games info and group pairings below the scoreboards.

**Changes:**
- **`src/pages/TournamentScoreboards.tsx`**: After the scoreboard section, add a "Rounds & Matchups" section:
  - For each round, show round name, date, course, game type (with 2nd ball indicator for best ball).
  - Fetch `tournament_groups` and `tournament_group_players` for each round.
  - Display groups with player names and team color dots, showing who is paired against whom (using `team_matchup` data).
- Use existing `GAME_TYPE_LABELS` from `TournamentRoundCard.tsx`.

## 4. Live Group Matches as Default Leaderboard

Make "Live Group Matches" the default selected scoreboard in the in-round Leaderboard tab.

**Changes:**
- **`src/components/tournament/TournamentTabPanel.tsx`** (lines 77-81): When setting the default `selectedScoreboardId`, prefer the scoreboard with `scoreboard_type === 'group_matches'` if one exists. Fall back to first scoreboard.
- **`src/hooks/useTournaments.ts`** (`createTournament`): Auto-create a `group_matches` scoreboard with `display_order: 0` (lowest) when creating a tournament, so it always exists and appears first.
- **`src/components/tournament-admin/ScoreboardManager.tsx`**: When generating suggestions, keep `group_matches` suggestion but it will already be auto-created.

## 5. Tournament Icon on "Resume Round" Button

If the active round is a tournament round, show a Trophy icon next to "Resume Round" on the home page.

**Changes:**
- **`src/components/Landing.tsx`** (lines 203-213): Check `currentRound?.gameData?.['_TOURNAMENT_META']`. If present, add a `<Trophy>` icon next to the Play icon in the Resume Round button. Change text to "Resume Tournament Round" or add a small trophy badge.

---

**Files touched**: ~10 files, 1 DB migration.

