

# Show GHIN Sync Status on My Players

## Problem
The My Players page shows a "Linked" badge for players connected to app users, but doesn't indicate whether that linked user has a synced GHIN handicap. Users want to know if the handicap shown is GHIN-verified.

## Changes

### 1. Database: Update `get_saved_players_with_profiles` function
Add `ghin_number` and `ghin_last_synced` to the return columns from the joined `profiles` table. This way linked players will carry their GHIN status.

### 2. `src/hooks/useSavedPlayers.tsx`
- Add `ghin_number?: string | null` and `ghin_last_synced?: string | null` to the `SavedPlayer` interface

### 3. `src/pages/Players.tsx`
- For linked players that have a `ghin_number`, show a small "GHIN Synced" badge (green tint) next to or below the existing "Linked" badge
- If linked but no GHIN, continue showing just the "Linked" badge as today

The badge will look like:
```
PlayerName  [✓ Linked] [GHIN ✓]
Handicap: 12.4 • Tee: White
```

**1 file changed, 1 database migration, no new tables.**

