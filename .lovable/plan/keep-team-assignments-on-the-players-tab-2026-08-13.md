# Keep team assignments on the Players tab

Assigning a team currently saves correctly, but the page snaps back to the Overview tab and the dot appears to lag. Fix both, and add an explicit confirm step.

## What changes

- Assigning a team from a player row updates the colored dot and team name immediately, without any page flicker.
- The view stays on the Players tab after saving (it currently jumps back to Overview).
- Team picks are staged: choosing a team marks the row as "pending" (dot shown in the new team color, slightly dimmed) and a "Save team assignments" bar appears at the bottom of the player list showing how many players changed.
- Clicking Save writes all pending assignments at once and shows a confirmation toast; a Cancel option discards pending picks.
- If there are no pending changes, the bar is hidden.

## Technical notes

- Cause of the tab reset: `src/pages/TournamentAdminDashboard.tsx` returns a full-page loading screen whenever `isLoading` is true, and `fetchAll` in `useTournamentDetail` sets `isLoading` on every refetch. The `Tabs` component is uncontrolled with `defaultValue="overview"`, so the remount resets the tab.
  - Fix: make `Tabs` controlled with a `activeTab` state, and only show the full-page loader on the initial load (track a `hasLoaded` flag, or gate the loader on `isLoading && !tournament`).
- `src/hooks/useTournamentDetail.ts`: have `fetchAll` accept a quiet/background option (or skip `setIsLoading(true)` when data already exists) so post-save refetches do not blank the page.
- `src/components/tournament-admin/PlayerListAdmin.tsx`: hold a `pendingTeams: Record<playerId, string | null>` state; the dot/name render from `pendingTeams[p.id] ?? p.team_id`. Save loops the pending entries through the existing `onUpdatePlayer(id, { team_id })` and clears the map on success.
