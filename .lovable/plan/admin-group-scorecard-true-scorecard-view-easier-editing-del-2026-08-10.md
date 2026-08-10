# Admin Group Scorecard: true scorecard view + easier editing + delete group

## What changes

**1. Scorecard layout (replaces the current vertical 18-row table)**

Turn the admin score editor into a classic horizontal scorecard:

```text
Hole   1  2  3  4  5  6  7  8  9  OUT | 10 ... 18  IN   TOT
Par    4  3  5  4  4  3  4  5  4   36 | ...        36    72
Josh   5  3  6  4  4  4  4  5  4   39 | ...        38    77
Mark   4  4  5  5  4  3  4  6  4   39 | ...        37    76
Result W  H  L  ...
```

- Front nine and back nine shown as two stacked scorecard blocks (works on phone and desktop without pinch-zooming).
- Rows: Hole, Par (from the round's course data), one row per player, plus a Result row showing each hole's match result.
- OUT / IN / TOT totals per player, live-updating as edits are made.
- Team color accents on player name cells so pairings are readable at a glance.

**2. Editing without the spinner arrows**

- Score cells become large tap targets (roughly 44px) instead of small buttons.
- Tapping a cell opens an inline text field using a numeric keypad on mobile — no up/down stepper arrows appear, since the field is a text input with numeric input mode rather than a number input.
- Typing a value auto-advances to the next player on that hole; Tab / Enter moves forward, Shift+Tab back, arrow keys move between cells.
- Pending (unsaved) edits keep the existing highlight, unsaved counter, and Save All bar — the save path itself is unchanged.
- Admin-override scores keep the gold asterisk marker.

**3. Delete the whole group**

- Add the same Danger Zone / Delete Group Round action that already exists on the live admin view to the plain admin scorecard page, with the existing confirmation dialog and cascade delete order (results, scores, group players, group).

## Technical notes

- Rewrite `src/components/tournament-admin/GroupScorecardAdmin.tsx` as the scorecard grid; keep its props contract (`groupPlayers`, `teams`, `scores`, `results`, `onBatchSave`) and add an optional `courseHoles` prop for par values.
- `courseHoles` is already returned by `useTournamentScorecard`, so both `TournamentAdminScorecard.tsx` and `TournamentAdminLiveView.tsx` just pass it through.
- Extract the delete-group logic and dialog from `TournamentAdminLiveView.tsx` into a shared `DeleteGroupButton` component so both pages use one implementation.
- No changes to scoring engines, save RPCs, or result calculation.
