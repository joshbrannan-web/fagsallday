
## Add "Find App User" to Setup Wizard Step 2

### Overview

Add a button in the player setup step (Step 2 of 3) that lets users search for other app users by name. When a user is found and selected, they are automatically added to the user's "My Players" list as a linked player and filled into the current round's player slot.

### Changes

**Modified file: `src/components/SetupWizard.tsx`**

1. **Import `UserSearchDialog`** from `@/components/UserSearchDialog`

2. **Add state variables:**
   - `showUserSearch: boolean` (default `false`)
   - `userSearchSlotIndex: number | null` (default `null`) -- tracks which player slot triggered the search, or `null` if adding a new player

3. **Add a handler `handleAppUserSelected`** that:
   - Receives the selected user (`{ id, display_name }`) and the slot index
   - Calls `addSavedPlayer(display_name, 0, 'White', userId)` to save + link the player in "My Players"
   - Fetches the user's handicap from profiles table via `supabase.from('profiles').select('handicap_index').eq('id', userId).single()` -- but since RLS only allows users to read their own profile, this won't work. Instead, we'll use the display_name and default handicap (0), and the user can manually adjust. The linked_user_id is what matters for sharing.
   - Fills the player slot (or adds to first empty slot / appends) with the user's display name, handicap 0, and `linkedUserId` set

4. **Add "Find App User" button** in Step 2, next to the existing "Add Player" and "Saved Players" buttons (the bottom button row at lines 1714-1758):
   - Show a `Search` icon button labeled with a person-search icon (`Users` or `Search`)
   - Only visible when `user` is logged in
   - Clicking opens `UserSearchDialog`

5. **Render `UserSearchDialog`** at the bottom of the Step 2 section with:
   - `open={showUserSearch}`
   - `onOpenChange={setShowUserSearch}`
   - `title="Find App User"`
   - `onSelect` handler that calls `handleAppUserSelected`

### UI Layout (Bottom buttons in Step 2)

Currently:
- [Add Player] [Saved Players icon]

Updated:
- [Add Player] [Find App User icon] [Saved Players icon]

The "Find App User" button uses a `Search` icon to distinguish it from the existing saved players button.

### Flow

1. User taps the "Find App User" button
2. `UserSearchDialog` opens (same component used on My Players page)
3. User types a name and searches
4. Results show matching app users
5. User taps a result
6. The selected user is:
   - Added to "My Players" as a linked player (via `addSavedPlayer`)
   - Filled into the next available empty player slot in the round setup
   - Shows the "Linked User" badge on their player card
7. Dialog closes

### Technical Details

- Reuses the existing `UserSearchDialog` component and `search_users_by_name` RPC -- no new backend changes needed
- Reuses the existing `addSavedPlayer` from `useSavedPlayers` hook -- handles dedup (if player name already exists, updates instead)
- The selected user's handicap defaults to 0 since we can't read other users' profiles (RLS restriction). The user can manually adjust the handicap in the slot.
- `linkedUserId` is set on the player slot so round sharing works correctly when the round starts
