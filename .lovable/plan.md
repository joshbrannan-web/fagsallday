

## Enhance WizardStepPlayers with My Players List + Search

### Problem
Currently the wizard only searches app users via `search_users_by_name` RPC. It does not show the user's saved players ("My Players") list, making it tedious to add known playing partners.

### Plan

**File: `src/components/tournament-admin/WizardStepPlayers.tsx`**

Rewrite to include two sections above the added-players list:

1. **My Players section** — Use `useSavedPlayers` hook to fetch the user's saved players on mount. Display them as a scrollable list of compact cards (name + handicap). Each card has an "Add" button (disabled if already added). Clicking adds them with their saved handicap and optionally their `linked_user_id` as `userId`. Filter this list by the search term when one is entered.

2. **Search App Users section** — Keep the existing `search_users_by_name` RPC search, but show results in a separate "App Users" group below filtered My Players. Include the "Add manually" fallback when no results found.

**Layout:**
- Single search input at top (searches both My Players locally and app users via RPC)
- Below search: two groups in a dropdown/panel when search is active:
  - "My Players" — locally filtered saved players matching the search term
  - "App Users" — results from RPC (excluding already-added players and those in My Players results to avoid duplicates)
- When search is empty: show full My Players list as selectable cards
- Added players list below (unchanged — name, handicap, team dropdown, remove)

**Key details:**
- Import `useSavedPlayers` from `@/hooks/useSavedPlayers`
- When adding a saved player, use their `handicap_index` as the default `handicapIndex` and their `linked_user_id` as `userId`
- Deduplicate: hide players from search results if they're already in the tournament player list
- Keep the "Add manually" option when no results found in either source

