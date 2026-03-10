

# Fix: Player Handicap Not Pulled from Profile in Setup

## Problem
When adding a player via the "Search Users" dialog (`handleAppUserSelected`), the handicap is hardcoded to `0` instead of fetching the linked user's actual profile handicap. The saved player record is also created with handicap `0`. This means the scorecard always shows "HCP 0" for these players.

## Solution
In `handleAppUserSelected` in `src/components/SetupWizard.tsx`, fetch the selected user's profile to get their real `handicap_index` before creating the player object and saving them.

### Changes

**`src/components/SetupWizard.tsx`** — `handleAppUserSelected` function (lines 269-299):
1. After receiving the selected user, query their profile from the `profiles` table to get `handicap_index`
2. Use the fetched handicap (falling back to 0 if unavailable) for both:
   - The `addSavedPlayer` call (so the saved player record has the correct handicap)
   - The `Player` object (so `handicapIndex` and `courseHandicap` are correct immediately)

```typescript
const handleAppUserSelected = async (selectedUser: { id: string; display_name: string }) => {
  // Fetch the user's profile to get their handicap
  const { data: profileData } = await supabase
    .from('profiles')
    .select('handicap_index')
    .eq('id', selectedUser.id)
    .single();

  const handicap = profileData?.handicap_index ?? 0;

  await addSavedPlayer(selectedUser.display_name, handicap, 'White', selectedUser.id);

  const newPlayer: Player = {
    id: Date.now().toString(),
    name: selectedUser.display_name,
    handicapIndex: handicap,
    courseHandicap: handicap ? calculateCourseHandicap(handicap, 72) : 0,
    tee: 'White',
    linkedUserId: selectedUser.id,
  };
  // ... rest unchanged
};
```

**Note:** The profiles RLS policy only allows users to view their own profile. We need to check if the query will succeed. If not, a database function or a broader SELECT policy scoped to authenticated users may be needed.

**1 file changed, potentially 1 migration if RLS blocks cross-user profile reads.**

