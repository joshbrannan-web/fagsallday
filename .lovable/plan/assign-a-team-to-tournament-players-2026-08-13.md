# Assign a team to tournament players

On the tournament admin Players tab, players without a team show only their name (no colored dot). Add a way to pick a team right in the list.

## What changes

- Each player row gets a small team picker in place of the current static color dot:
  - Player with a team: shows the team color dot + team name; clicking opens a dropdown of all tournament teams.
  - Player with no team: shows a muted "No team" chip so it is obvious an assignment is missing; same dropdown on click.
- Selecting a team saves immediately and updates the dot/name in place.
- Optional "No team" entry in the dropdown so an assignment can be cleared.
- Nothing else on the row changes (handicap edit, override badge, remove button stay as-is).

## Technical notes

- File: `src/components/tournament-admin/PlayerListAdmin.tsx` — replace the static color dot with a shadcn `Select` bound to `p.team_id`, options built from the `teams` prop.
- Saving uses the existing `onUpdatePlayer(id, { team_id })`, which already maps to `updatePlayer` in `src/hooks/useTournamentDetail.ts` (already accepts `team_id`).
- No database or schema changes; `tournament_players.team_id` is already nullable.
