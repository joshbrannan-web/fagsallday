# Show and edit per-round team scoring in the Rounds tab

The tournament CGC 2026 is set to "Custom Pts per Round" and all three rounds are stored correctly as Front/Back/Overall (2 / 2 / 2). The problem is the admin dashboard Rounds tab: it never reads or writes those settings, so it only ever shows the game's "pts/hole" line and the round editor hides the team scoring section entirely.

## What changes

**Round card summary line** — under each round, alongside the game type, show the round's team scoring rule when the tournament uses Custom Pts per Round, e.g. "Front/Back/Overall — 2 / 2 / 2", "Per round — 3 pts", "Per hole only", or "Per hole + per round — 3 pts".

**Round editor** — clicking the pencil now shows the same "Team Scoring for this Round" toggle group used in the create wizard (Per Hole only / Per Round only / Per Hole + Per Round / Front-Back-Overall plus the point inputs), pre-filled with the round's saved values. Saving persists them.

The section only appears when the tournament's team scoring method is Custom Pts per Round, matching the wizard.

## Technical notes

- `dbToRoundConfig` in `src/pages/TournamentAdminDashboard.tsx`: map `round.team_scoring_mode` into `teamScoringMode` and `round.team_scoring_points` into `teamScoringPoints` (falling back to the wizard defaults when absent).
- `saveRoundEdits`: include `team_scoring_mode` and `team_scoring_points` in the `updateRound` payload.
- Pass `showTeamScoring={tournament?.team_scoring_method === 'custom_pts_per_round'}` to `RoundConfigCard` in the edit block.
- Add the summary line next to the existing `{game.game_type} • {pts}/hole` text, derived from the round row (display only).
- No migration or scoring-engine change; `calcRoundTeamAward` already handles all four modes.
