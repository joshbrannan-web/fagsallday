

# Auto-Populate Handicap When Linking to an App User

## Problem
When adding a player to "My Players" and linking them to an app user via the search dialog, the user's handicap from their profile is not auto-filled into the handicap field. The user must manually type it.

## Changes

### `src/pages/Players.tsx`

1. When a user is selected from the "Link to App User" dialog for a **new** player, auto-populate `newHandicap` with the selected user's `handicap_index` (in addition to already setting the name).

2. When linking an **existing** player to an app user, update the player's `handicap_index` with the linked user's profile handicap.

### `src/components/UserSearchDialog.tsx`

Already returns `handicap_index` in the result — no changes needed.

### Specific edits

**New player link handler** (~line 86 area): When `onSelect` fires from the new-player link dialog, set `setNewHandicap(user.handicap_index?.toString() || '0')` alongside the existing name/userId state updates.

**Existing player link handler** (~line 101-118 area): After linking, call `updatePlayer` with the linked user's handicap so it syncs automatically.

**2 small edits in 1 file.**

