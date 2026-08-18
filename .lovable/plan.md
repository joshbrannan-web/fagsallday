# Admin handicap editing for registrants and tournament players

Admins can already override a handicap on the tournament Players tab, but a registrant's handicap on the registration page is read-only. This adds inline editing in both places and makes the Players tab clearer.

## Registration page (registrants table)

- The HCP column becomes editable: click the value to open a small numeric input, press Enter or Save to commit, Escape to cancel.
- Saving writes the new handicap to the registration entry, and — if the registrant has an account — to their player profile so it flows everywhere else.
- Blank clears the handicap back to "—"; values must be between -10 and 54.
- After saving, the entry re-syncs to the Google Sheet if one is attached, so the sheet doesn't go stale.
- Access is unchanged: only the registration owner (or a super admin) can edit, which the existing access rules already enforce.

## Tournament Players tab

- Editing already exists but is unlabeled; the edit box gets a clear "Handicap" label and validation (-10 to 54) so a bad value can't be saved.
- The row keeps showing the "HCP Override" badge and the Reset link that restores the player's real handicap.

## Technical notes

- `src/components/tournament-admin/RegistrationEntryList.tsx`: add an `onUpdateHandicap(entry, value: number | null)` prop and an inline edit cell (same pattern as `PlayerListAdmin`).
- `src/pages/TournamentRegistrationAdmin.tsx`: implement the handler — update `tournament_registration_entries.handicap_index`, update `profiles.handicap_index` when `user_id` is set, then invoke `sync-registration-to-sheets` for that entry and refresh the list.
- `src/components/tournament-admin/PlayerListAdmin.tsx`: clamp/validate `handicap_override` input and add the label.
- No migration needed — existing update policies cover the registration owner and super admins.
