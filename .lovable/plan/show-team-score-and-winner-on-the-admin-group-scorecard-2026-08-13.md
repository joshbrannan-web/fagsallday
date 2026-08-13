# Show team score and winner on the admin group scorecard

## What changes

The header card at the top of the group scorecard currently says only "18 holes played / Final". It becomes a match summary that names both teams, shows the points each team earned in this group's match, and calls the winner.

New header content:

```text
        Putt Pirates   6 — 3   Blue Team
      Putt Pirates wins 6 — 3 · Final
```

- Each team name is shown in its own team color with a color dot.
- Points come from the saved per-hole results for this group, summed per team (halved holes split as already stored).
- Status line:
  - All holes played: "<Winner> wins X — Y", or "Match Halved X — X" when tied.
  - Mid-round: "<Leader> leads X — Y · Thru N", or "All Square X — X · Thru N".
  - No holes played: "Not Started".
- The winning/leading team is emphasized (bold, full-contrast text); the trailing team is dimmed.
- Unsaved pending edits are not counted — points reflect saved results only, same as the hole-winner highlighting.

## Technical notes

- `src/components/tournament-admin/MatchStatusBar.tsx`: extend props to accept the two teams (name + color) and their point totals, and render the score line. Existing props stay compatible.
- `src/components/tournament-admin/GroupScorecardAdmin.tsx`: derive `teamTotals` with a memo that sums `team_points` across `results`, resolve the two team ids from the group players' `team_id` values (ordered as in `teams`), and pass them to `MatchStatusBar`.
- No changes to scoring engine, saving paths, or database.
