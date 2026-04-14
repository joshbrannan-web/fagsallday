

# Auto-Link Players & Auto-Sync GHIN on Round Setup

## What this does
1. When a user types a player name that matches an existing app user, automatically link them (currently only happens via explicit "Find App User" search)
2. When players are added to a round, if any linked players have GHIN numbers, automatically sync their latest handicap from USGA before the round starts

## Plan

### Step 1 — Auto-link when selecting/adding a player by name
In `SetupWizard.tsx`, after a player name is entered manually (on blur or when advancing from Step 2), search for an app user with that exact name using the existing `search_users_by_name` RPC. If a single exact match is found:
- Auto-set `linkedUserId` on the player
- Auto-save to `saved_players` with the link (via `addSavedPlayer`)
- Show a subtle toast: "Linked [name] to their account"

This applies to `handlePlayerChange` when the `name` field changes, triggered on blur of the name input.

### Step 2 — Auto-sync GHIN for all linked players when starting a round
In `SetupWizard.tsx`, modify the transition from Step 2 → Step 3 (inside `handleNext` when `step === 2`). Before advancing:
- Collect all players with a `linkedUserId`
- For each, look up their saved player record to check for `ghin_number` and `ghin_last_synced`
- For any player whose GHIN was last synced > 24 hours ago (or never), call `sync-ghin-handicap` in parallel
- Update player handicap indices with fresh data before proceeding
- Show a brief loading indicator during sync

### Files changed
- **`src/components/SetupWizard.tsx`**:
  - Add `onBlur` handler on player name inputs that calls `search_users_by_name` for auto-linking
  - Add GHIN sync logic in `handleNext` at step 2 transition
  - Add a syncing state indicator

### No database or edge function changes needed
All required infrastructure already exists (`search_users_by_name` RPC, `sync-ghin-handicap` edge function, `get_saved_players_with_profiles` RPC).

