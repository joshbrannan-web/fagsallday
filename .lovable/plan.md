
# Registration ↔ Tournament Lifecycle

Three changes to the registration admin flow.

## 1. Switching the Linked Tournament

When the admin changes the dropdown from Tournament A → Tournament B (or → None), and there are already approved registrants:

- Show a confirmation `AlertDialog` summarizing: "N approved registrants will be moved from [A] to [B]. Their tournament_players row in [A] will be removed and recreated in [B]."
- On confirm, call a new edge function `relink-registration-tournament` that:
  1. Loads all approved entries for the config.
  2. For each entry, deletes the matching `tournament_players` row in the old tournament (matched by `display_name`, same logic as approve).
  3. Inserts a new `tournament_players` row in the new tournament (skipped if linking to None).
  4. Updates `tournament_registration_configs.tournament_id`.
- **Guard:** If the old tournament's `status` is `active` (live), block the switch with a toast: "Cannot change linked tournament while the tournament is live." The dropdown change is reverted.
- If switching from None → B, just push all approved entries into B (no removal step).

## 2. "Sync All Approved to Tournament" Button

Add a button next to the tournament link selector on `TournamentRegistrationAdmin.tsx`, visible only when a tournament is linked and there is at least one approved entry.

- Calls a new edge function `sync-approved-to-tournament`:
  - Loads all approved entries for the config.
  - For each, upserts into `tournament_players` (insert if no row with matching `display_name` in that tournament; skip if present).
  - Returns counts: `{ added, skipped }`.
- Toast result: "Added X players, Y already present."
- Useful when a tournament was linked *after* approvals happened, or to repair drift.

## 3. Deleting a Registrant — Two Options

Replace the current single-action delete with an `AlertDialog` that offers two buttons when the config has a linked tournament AND the entry is approved:

- **Delete Registrant Only** — Current behavior. Removes the registration entry + Google Sheet row. Leaves the `tournament_players` row (and any team/group/score assignments) intact. Use mid-tournament when the person played but you no longer want their registration record.
- **Delete Registrant + Tournament Data** — Removes the registration entry + Google Sheet row AND deletes the matching `tournament_players` row. Postgres cascade behavior on related rows:
  - `tournament_group_players` referencing this player → also removed.
  - `tournament_hole_scores` for this player → also removed.
  - `team_id` assignment goes with the `tournament_players` row.
  - We do NOT block on score presence; the admin has explicitly chosen the destructive option.

When the entry is pending/rejected OR no tournament is linked, skip the dialog and just delete (current behavior).

Wire both through the existing `delete-registration` edge function with a new `mode: "entry_only" | "entry_and_tournament"` parameter (default `entry_only` for backward compat). When `entry_and_tournament`, the function looks up the linked `tournament_id`, finds the `tournament_players` row by `display_name`, deletes related `tournament_group_players` and `tournament_hole_scores` rows explicitly (no FK cascades exist on these tables), then deletes the player row.

## Technical Details

**Files to change:**
- `src/pages/TournamentRegistrationAdmin.tsx` — dropdown guard + confirmation, new "Sync All" button.
- `src/components/tournament-admin/RegistrationEntryList.tsx` — pass through new delete-mode signal; let parent open the AlertDialog.
- `supabase/functions/delete-registration/index.ts` — accept `mode`, perform tournament cleanup when requested.
- New: `supabase/functions/relink-registration-tournament/index.ts`.
- New: `supabase/functions/sync-approved-to-tournament/index.ts`.

**Player matching:** All operations match by `(tournament_id, display_name)` exactly, mirroring the existing approve-registration logic. No fuzzy matching.

**Authorization:** All new/changed edge functions verify the caller owns the `tournament_registration_configs` row (same pattern as existing functions).

**No DB migrations** are needed.

## Out of Scope

- No bulk re-approve flow.
- No undo for destructive deletes.
- No UI to reassign team/group after relink — admin manages that in the tournament admin pages.
