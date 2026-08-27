# Scorecard & Results access from the Results tab

Add a "View Scorecard & Results" button to each round in the tournament admin Results tab, matching the button already on the Rounds tab.

## What changes

- Every round listed under Results gets a "View Scorecard & Results" button when the round card is expanded.
- Tapping it opens the existing admin hole-by-hole scorecard page for that round (same page the Rounds tab links to), including the Round Players / Match Players toggle.
- No changes to scoring, data fetching, or the results numbers themselves.

## Technical notes

- Edit `src/components/tournament-admin/RoundResultsDashboard.tsx`: add `useNavigate` and render a full-width outline `Button` with the `ClipboardList` icon at the top of each round's `AccordionContent`.
- Target route: `/tournament-admin/${tournament.id}/round/${round.id}/scorecard` — the route already exists and is used from `TournamentAdminDashboard.tsx`.
- Only presentation; no new props, queries, or backend work.
