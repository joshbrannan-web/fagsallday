# Clarify what "points per hole" actually does

When a round's team scoring mode is Per Round only or Front/Back/Overall, the per-hole points never reach the team totals — they only decide who wins each hole (and therefore the round or each segment). Today the UI still shows "1 pts/hole" with no explanation, which reads like those points are being counted.

## What changes

**Round editor (RoundConfigCard)** — when the tournament uses Custom Pts per Round:
- Modes `per_round` and `fbo`: relabel the field to "Points Per Hole (tiebreak only)" and show a short note under it — "These points only decide who wins each hole. They do not add to team totals in this mode."
- Modes `per_hole` and `per_hole_and_round`: keep the current label, no note (points do count).

**Round card summary (admin dashboard Rounds tab)** — for those same two modes, hide the "• N pts/hole" fragment from the game line so only the gold team-scoring line remains. For counting modes, leave the line as is.

Same treatment appears in the create-tournament wizard since it renders the same card.

## Technical notes

- `src/components/tournament-admin/RoundConfigCard.tsx`: derive `holePointsCount = !showTeamScoring || mode === 'per_hole' || mode === 'per_hole_and_round'`; use it to swap the Points Per Hole label and render the helper note; also apply to the "Customize hole points" collapsible label.
- `src/pages/TournamentAdminDashboard.tsx` (~line 516): only append `• {default_points_per_hole} pts/hole` when the round's mode counts hole points.
- Display only — no scoring-engine or database changes.
