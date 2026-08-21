# Deleting pairings: what happens today, and what to fix

## Short answer

Yes — deleting a pairing does remove it from the backend, and you can immediately create new pairings.

Verified in the database: the foreign keys from group players, hole scores, and hole results to `tournament_groups` are all set to cascade on delete, so removing a group also removes its players, entered scores, and per-hole results. Deleting a cross-group match also removes that match's hole results. Nothing is left behind that would block re-pairing.

Three real gaps show up around it, though.

## Gap 1 — Group numbers can collide or skip after a delete

New groups are numbered as "count of groups in this round + 1". After deleting Group 2 of 3, the next group added becomes Group 3 again — two groups labelled 3. The same count also includes test-mode groups, so pairing after a Test Start can jump the numbering.

Fix: number the new group as `max(group_number) + 1` among non-test groups in that round, instead of a row count.

## Gap 2 — A deleted group can leave an orphaned scoring round behind

Once a group starts play, it is linked to a row in the main `rounds` table (14 groups currently carry such a link). Deleting the group removes the tournament-side data, but that scoring round stays in the players' round list and in their on-device cache, so a player can still open a round that no longer belongs to any pairing.

Fix: when deleting a group that has a linked scoring round, delete that round too, and mark it so any device holding it in cache drops it on next load (same invalidation path already used for tournament deletion).

## Gap 3 — Deleting a pairing gives no warning about lost scores

Deleting from the pairings editor is immediate and silently discards any scores already entered for that group. The separate "Delete Group Round" button does warn; the pairings editor does not.

Fix: in the pairings editor, confirm before deleting, and if the group already has scores entered, say so explicitly in the confirmation ("Group 2 has 14 holes of scores — these will be permanently deleted").

## Technical notes

- `src/hooks/useTournamentDetail.ts`
  - `addGroup`: replace the count-based `nextGroupNumber` with a max-based query filtered to `is_test = false`.
  - `deleteGroup`: read the group's `round_id` first; if present, delete the linked `rounds` row and clear the offline cache marker; keep relying on cascades for scores/results; refresh after.
- `src/components/tournament-admin/RoundPairingsEditor.tsx`: wrap the group delete button in an `AlertDialog` (matching `DeleteGroupButton.tsx`), showing the count of holes already scored for that group.
- No schema change needed — the cascade rules are already correct.
