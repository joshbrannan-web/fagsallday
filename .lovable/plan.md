

# Revised Plan: Admin Live View with Full Control

## What the Previous Plan Was Missing

The previous plan only rendered `TournamentTabPanel`, which is a **read-only display** — it shows match status, hole tracker, and player summaries but has **no score editing, no round deletion, no controls**. The actual player score-entry experience lives in `ActiveRound.tsx` (2500 lines) and depends on a local round context that the admin does not have.

## What the Admin Actually Needs

The admin should be able to:
1. **View the live match status** (team totals, hole-by-hole results, player summary) — same as a player sees
2. **Edit any player's score** on any hole — with super-user override marking
3. **Trigger engine recalculation** after score changes (already exists in `useTournamentScorecard`)
4. **Delete all group data** (scores, results, group players, group) to effectively reset/delete a group's round

## Approach: Combine TournamentTabPanel + GroupScorecardAdmin

Rather than trying to replicate `ActiveRound.tsx` (which is tightly coupled to local round state), build a new admin page that combines:
- **Top**: Admin Mode banner (sticky, amber/gold)
- **Tournament view**: `TournamentTabPanel` for the live match visualization (read-only display of match status, hole tracker, player summary)
- **Admin scorecard**: `GroupScorecardAdmin` for score editing (tap any cell to override scores, with engine recalc)
- **Danger zone**: Button to delete the group's round data (scores, results, group players, group record)

This gives the admin everything a player can see PLUS admin-only edit and delete capabilities, all on one page.

## Files

### 1. New: `src/pages/TournamentAdminLiveView.tsx`
- Route: `/tournament-admin/:tournamentId/round/:roundId/group/:groupId/live`
- Access guard via `useTournamentAdmin`
- Uses `useTournamentOverlay(groupId)` for live match data → feeds `TournamentTabPanel`
- Uses `useTournamentScorecard(groupId)` for score editing → feeds `GroupScorecardAdmin`
- Uses `useTournamentDetail(tournamentId)` for teams/players data
- Sticky amber banner: "Admin Mode — Viewing as Player" with Shield icon
- Two collapsible sections:
  - **Match View** — `TournamentTabPanel` (live status, hole tracker, player summary)
  - **Score Editor** — `GroupScorecardAdmin` (tap-to-edit any score)
- **Delete Group Round** button at bottom — deletes `tournament_hole_results`, `tournament_hole_scores`, `tournament_group_players`, and `tournament_groups` records for this group, then navigates back to admin dashboard

### 2. `src/App.tsx`
- Add route: `/tournament-admin/:tournamentId/round/:roundId/group/:groupId/live`

### 3. `src/pages/TournamentAdminDashboard.tsx` (lines 326-335)
- Add a second button "View Live" next to "View Scorecard" in the Live Activity section, navigating to the new live view route

### 4. `src/pages/TournamentAdminScorecard.tsx`
- Add "View Live" button in the header next to the back button

## Summary

| File | Change |
|---|---|
| `src/pages/TournamentAdminLiveView.tsx` | New — admin banner + TournamentTabPanel + GroupScorecardAdmin + delete group |
| `src/App.tsx` | Add route |
| `src/pages/TournamentAdminDashboard.tsx` | Add "View Live" button in Live Activity |
| `src/pages/TournamentAdminScorecard.tsx` | Add "View Live" button in header |

4 files (1 new), 0 database changes.

