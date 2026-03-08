

# Fix: 404 when clicking group matches in scoreboard

## Problem

When you click a group match row (e.g., "Brandon / Clint") in the Live Group Matches scoreboard, you're navigated to `/tournament//round/.../group/...` — note the **double slash** where the tournament join code should be. This causes a 404.

The root cause is in `TournamentTabPanel.tsx` line 204, where `joinCode=""` is hardcoded as an empty string when rendering `ScoreboardRenderer`. The `GroupMatchesScoreboard` uses this join code to build the navigation URL.

## Fix

**`src/components/tournament/TournamentTabPanel.tsx`**
- The component already receives `tournamentId` as an optional prop
- Fetch the tournament's `join_code` from the database using `tournamentId`, or pass it through as a new prop
- Simplest approach: add a `joinCode` prop to `TournamentTabPanel` and pass it from callers

**Callers to update:**
1. `src/pages/TournamentAdminLiveView.tsx` — has `tournamentId`, can get `tournament.join_code` from `useTournamentDetail`
2. `src/components/tournament/TournamentGameOverlay.tsx` — need to check if it renders `TournamentTabPanel` and pass join code

Alternatively, since `TournamentTabPanel` already has `tournamentId`, we can do a small lookup inside the component itself using a query. But the cleaner approach is to pass `joinCode` as a prop since the parent already has the tournament data.

## Changes

| File | Change |
|---|---|
| `src/components/tournament/TournamentTabPanel.tsx` | Add `joinCode?: string` to Props interface; use it on line 204 instead of `""` |
| `src/pages/TournamentAdminLiveView.tsx` | Pass `joinCode={tournament?.join_code}` to `TournamentTabPanel` |
| `src/components/tournament/TournamentGameOverlay.tsx` | Pass `joinCode` if it renders `TournamentTabPanel` (need to verify) |

2-3 files changed, 0 database changes.

