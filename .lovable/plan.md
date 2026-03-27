

# Admin Score Editing from Rounds Tab

## What changes

When a round is completed (or active), the Rounds tab in the Tournament Admin Dashboard will show an expandable list of groups for that round. Each group shows its players and a button to open the score editor. Clicking it navigates to the existing `TournamentAdminScorecard` page (which already has the batch-save `GroupScorecardAdmin`).

## Implementation

### `src/pages/TournamentAdminDashboard.tsx`

In the Rounds tab (lines 428-505), after the round info display (inside the non-editing branch, after the active warning), add a section for completed/active rounds:

- Show a collapsible "Edit Scores" section with the groups for that round
- For each group, show the player names and an "Edit Scorecard" button that navigates to `/tournament-admin/${tournamentId}/round/${roundId}/group/${groupId}`
- Use the existing `groups` and `groupPlayers` state already available in the component

The change is ~30 lines added to the existing Rounds tab card, using data already loaded. No new files, hooks, or database changes needed.

### Technical detail

```text
Rounds Tab Card (completed/active round)
  ├── Round name, status badge, edit/delete buttons  (existing)
  ├── Date, game type info                           (existing)
  └── NEW: "Edit Scores" expandable section
       └── Group cards (1 per group in this round)
            ├── "Group N" + player names
            └── "Edit Scorecard" → navigates to TournamentAdminScorecard
```

1 file changed, 0 database changes.

