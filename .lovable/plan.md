

# 1v1 Sub-Matchup Pairings for Groups of 4

## Problem
When a round's game type is 1v1 (e.g. match_play_individual, alternate_shot_twosomes, scramble_2), the admin can currently add groups of 2 or 4. But for groups of 4, there's no way to specify which two players play each other in the two separate 1v1 matches.

## Solution
Add a second step in the group creation flow within `RoundPairingsEditor`. When the game is a 1v1 type and 4 players are selected, show a matchup assignment UI where the admin pairs players into two 1v1 matches (Match A and Match B). Store these sub-matchups in the group's existing `team_matchup` JSONB column as `subMatchups: [{playerA, playerB}, {playerA, playerB}]`.

## 1v1 Game Types
- `match_play_individual`
- `alternate_shot_twosomes`
- `scramble_2`

## UI Flow
1. Admin clicks "Add Group"
2. Selects 2 or 4 players (unchanged)
3. **If 1v1 game AND 4 players selected**: before saving, show a matchup pairing step:
   - "Assign 1v1 Matches" header
   - Two dropdowns/selectors — Match 1: Player A vs Player B, Match 2: Player C vs Player D
   - Each player can only appear in one match
   - Default: first two selected = Match 1, last two = Match 2
4. Save stores the sub-matchups in `team_matchup` JSONB
5. Existing group cards display sub-matchup info when present

## Data Shape (stored in `tournament_groups.team_matchup`)
```json
{
  "teamAId": "...",
  "teamBId": "...",
  "subMatchups": [
    { "playerA": "player-id-1", "playerB": "player-id-2" },
    { "playerA": "player-id-3", "playerB": "player-id-4" }
  ]
}
```

No database migration needed — `team_matchup` is already JSONB.

## Files Changed
1. **`src/components/tournament-admin/RoundPairingsEditor.tsx`** — Accept `gameType` prop; add matchup assignment step for 1v1 games with 4 players; display sub-matchups on existing group cards
2. **`src/pages/TournamentAdminDashboard.tsx`** — Pass the round's game type to `RoundPairingsEditor`
3. **`src/hooks/useTournamentDetail.ts`** — Update `addGroup` to accept optional `subMatchups` and merge into `team_matchup` JSONB

