

## Share Rounds with Other App Users

### Overview
When a round finishes, all players who are linked to registered app users will automatically see that round in their "Past Rounds" history as a locked, read-only round. This requires:
1. A way to link players to app user accounts
2. A new database table tracking round participants
3. Updating round history to include rounds where the user was a participant

### Database Changes

**New table: `round_participants`**
Tracks which user accounts participated in each round.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| round_id | uuid (FK) | References rounds.id, cascade delete |
| user_id | uuid | The participating user's auth ID |
| player_name | text | Display name at time of round |
| created_at | timestamptz | Default now() |
| UNIQUE | | (round_id, user_id) |

RLS policies:
- SELECT: Users can see rows where `user_id = auth.uid()` OR where they own the round (via a join or subquery)
- INSERT: Only the round owner can insert participants (checked via rounds table)
- DELETE: Only the round owner can remove participants

**Add column to `saved_players`:**
- `linked_user_id` (uuid, nullable) -- links this saved player to an app user account

**New database function: `search_users_by_name`**
A security-definer function that searches profiles by display_name (case-insensitive partial match), returning only `id` and `display_name` -- never exposing emails or other sensitive data. Limited to 10 results.

### Code Changes

**1. Player Linking UI (`src/components/SetupWizard.tsx` - Step 2)**
- Add a "Link to App User" button next to each player slot
- Opens a search dialog where you can type a name and see matching app users
- When selected, the player's name and handicap auto-fill from the linked user's profile
- A small badge/icon indicates "linked" players

**2. My Players page (`src/pages/Players.tsx`)**
- Add a "Link to User" option when adding or editing a player
- Shows a search input to find app users by display name
- Linked players show a badge indicating they're connected to a real account

**3. Saved Players hook (`src/hooks/useSavedPlayers.tsx`)**
- Update the `SavedPlayer` interface to include optional `linked_user_id`
- Pass `linked_user_id` through add/update operations

**4. Round Participants on Finish (`src/hooks/useRounds.tsx`)**
- When `finishRound()` or `lockRound()` is called, automatically insert rows into `round_participants` for any player whose `linked_user_id` is set (or whose name matches a saved player with a `linked_user_id`)
- The round owner is also recorded as a participant

**5. Fetch Shared Rounds (`src/hooks/useRounds.tsx`)**
- Update `fetchRounds` to also query `round_participants` for rounds where `user_id = auth.uid()` and the round is LOCKED or COMPLETE
- Merge these "shared rounds" into the rounds list, marked as read-only
- Add a `isShared` flag to the Round type so the UI can distinguish owned vs shared rounds

**6. Round History UI (`src/components/RoundHistory.tsx`)**
- Shared rounds appear in the "Completed Rounds" section with a "Shared" badge
- Shared rounds are view-only (no delete, no unlock, no edit)

**7. Round type update (`src/types.ts`)**
- Add optional `isShared?: boolean` and `ownerName?: string` to the `Round` interface

### Technical Details

- The `search_users_by_name` function is a SECURITY DEFINER that only exposes `id` and `display_name` from profiles -- no emails or other PII
- Round participants are inserted server-side when locking/completing a round; the `linked_user_id` from players_data determines who gets access
- Shared rounds are fetched via a separate query joining `round_participants` to `rounds`, so existing RLS on the rounds table is supplemented by a new SELECT policy: "Participants can view rounds they played in"
- The saved_players `linked_user_id` column is nullable so existing players are unaffected
- Player linking is optional -- manually typed players without a linked account simply won't trigger sharing

### Implementation Order
1. Database migration (new table, new column, new function, updated RLS)
2. Backend: search_users_by_name function
3. Update types and hooks (useSavedPlayers, useRounds)
4. Update SetupWizard player step with linking UI
5. Update Players page with linking UI
6. Update RoundHistory with shared round display

