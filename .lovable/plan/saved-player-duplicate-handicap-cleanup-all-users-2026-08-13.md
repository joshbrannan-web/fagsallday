# Saved-player duplicate & handicap cleanup (all users)

## What the data shows

Checked all 209 saved-player rows:

- **Duplicates: 3 cases** (not widespread). Each is the same pattern as Dallin — one row linked to a real account, plus an older unlinked copy of the same person:
  - Josh Brannan (in one user's list): linked row 10.5, stale unlinked row 11.6
  - Daniel Eskelson: linked row 11.9, stale unlinked row 11.3
  - Justin Hamilton: linked row 6.5, stale unlinked row 7.7
- **No duplicate linked rows** (same person linked twice) anywhere.
- **Stale handicaps: 87 rows** where a linked saved player's stored handicap differs from the linked account's current handicap. These don't display wrong today (the list function prefers the profile value), but they are the exact stale copies that made Dallin's edit look like it snapped back.

## Cleanup

1. For each of the 3 duplicate pairs: keep the linked row, delete the unlinked stale copy.
2. For all linked saved players: set the saved row's handicap equal to the linked account's current handicap, so local copies match the source of truth.
3. Leave unlinked, non-duplicate saved players untouched — their manually entered handicaps are intentional.

## Prevention (already partly in place)

- Editing a linked player already writes through to the linked account and syncs local duplicates.
- Add a guard when saving/linking a player: if the same person (same linked account, or same name for the same owner) already exists in that owner's list, update the existing row instead of inserting a second one.

## Technical notes

- One migration/data script: delete the 3 unlinked duplicate rows, then `UPDATE saved_players SET handicap_index = profiles.handicap_index` for all rows with a `linked_user_id`.
- Dedup guard goes in `src/hooks/useSavedPlayers.tsx` (add/link paths).
