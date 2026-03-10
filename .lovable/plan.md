

# Auto-Suggest Scoreboards with Preview

## What
When the admin opens the Scoreboards page, the app analyzes the tournament setup (teams, games, handicap settings) and suggests relevant scoreboards. Each suggestion shows a preview with example data. The admin can add, edit, or dismiss suggestions. Existing add/edit/delete functionality remains.

## Suggestion Logic (pure function)

Based on tournament config:
- **Teams exist (2+)** → suggest "Team Points" (team_points, sort: total_points desc) + "Team Round Result" (team_round_result, sort: wins desc)
- **Any game uses handicaps** → suggest "Individual Net" (individual_net, sort: net_score asc)
- **Always** → suggest "Individual Gross" (individual_gross, sort: gross_score asc)
- **Always** → suggest "Individual Points" (individual_points, sort: total_points desc)
- **Always** → suggest "Live Group Matches" (group_matches, sort: total_points desc)

Filter out any types already added as scoreboards.

## Preview

Each suggestion card has a "Preview" button that opens a Sheet showing the scoreboard renderer (`ScoreboardRenderer`) populated with **mock data** generated from the actual tournament teams/players. The mock data generator creates fake hole results, scores, etc. so the admin sees a realistic preview with their real team names/colors and player names.

## UI Changes

### `src/components/tournament-admin/ScoreboardManager.tsx`
- Accept new props: `teams`, `games`, `players`, `rounds`
- Above the existing scoreboard list, show a "Suggested Scoreboards" section when there are suggestions not yet added
- Each suggestion: card with name, type label, description of why it's suggested, "Preview" and "Add" buttons
- "Add" calls `onAdd` with pre-filled config
- "Preview" opens a Sheet with `ScoreboardRenderer` using mock data
- Add a helper `generateSuggestions(teams, games, scoreboards)` and `generateMockData(teams, players, rounds)`

### `src/pages/TournamentAdminScoreboards.tsx`
- Pass `teams`, `games`, `players`, `rounds` from `useTournamentDetail` down to `ScoreboardManager`

## Files Changed
1. **`src/components/tournament-admin/ScoreboardManager.tsx`** — Add suggestion logic, preview Sheet with mock data, suggestion cards
2. **`src/pages/TournamentAdminScoreboards.tsx`** — Pass additional props

