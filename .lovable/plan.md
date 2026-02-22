
## Add "Find App User" Button Next to Saved Players Dropdown

### Overview

Add a "Find App User" button inline with the "Choose from saved players" dropdown that appears on each player slot in Step 2. This gives users two ways to find app users: per-slot (next to the dropdown) and globally (at the bottom button row).

### Changes

**Modified file: `src/components/SetupWizard.tsx`**

Update the saved players selector area (around lines 1672-1695) to wrap the existing `Select` dropdown and a new "Find App User" button in a flex row.

Current layout per player slot:
```
[Choose from saved players...          v]
```

Updated layout per player slot:
```
[Choose from saved players...      v] [Search icon]
```

Specifically:
1. Wrap lines 1672-1695 in a `div` with `flex gap-2 items-center`
2. Add a `Button` (variant="outline", size="icon") with a `Search` icon next to the `Select` dropdown
3. Clicking the button sets `showUserSearch = true` and stores the current slot index in a new state variable `userSearchSlotIndex`
4. Update `handleAppUserSelected` to check `userSearchSlotIndex` -- if set, fill that specific slot instead of the first empty one; then reset it to `null`

**State addition:**
- Add `userSearchSlotIndex: number | null` (default `null`)

**Handler update (`handleAppUserSelected`):**
- If `userSearchSlotIndex !== null`, replace that specific player slot with the selected user
- If `userSearchSlotIndex === null` (triggered from bottom button), keep existing behavior (find first empty or append)
- Reset `userSearchSlotIndex` to `null` after handling

### Visibility
- The per-slot "Find App User" button shows when `user` is logged in (same condition as the bottom button)
- It appears even if `savedPlayers` is empty (unlike the dropdown which requires saved players to exist)
