

# Admin-Managed Pairings + Player Group Selection

## Overview
Two changes: (1) Admin creates groups/pairings per round from the dashboard, (2) Players pick from pre-created groups instead of selecting players themselves.

## 1. Admin: "Set Pairings" UI

### New component: `src/components/tournament-admin/RoundPairingsEditor.tsx`
A Sheet/dialog opened from the Overview tab's round cards. Shows:
- List of existing groups for the round (with players listed)
- "Add Group" button that opens an inline form to select 2 or 4 players from the tournament roster
- Player picker filters by team, shows handicap, prevents duplicates across groups
- Each group shows team matchup derived from player team assignments
- Delete group button per group
- Groups are saved to `tournament_groups` (status `'pending'`, no `round_id`) and `tournament_group_players`

### `src/hooks/useTournamentDetail.ts`
- Add `addGroup(roundId, playerIds)` — inserts a `tournament_group` + `tournament_group_players`
- Add `deleteGroup(groupId)` — deletes group and its players
- Fetch `tournament_group_players` alongside groups in `fetchAll` (new state: `groupPlayers`)
- Return `groupPlayers` from the hook

### `src/pages/TournamentAdminDashboard.tsx`
- In the Overview tab round cards, add a "Set Pairings" button (icon: Users) next to the status badge
- Clicking opens the `RoundPairingsEditor` sheet for that round
- Show pairing count: "3 groups set"

## 2. Player: Select Pre-Created Group

### `src/hooks/useTournamentRoundSetup.ts`
- On `selectRound`, fetch groups + group_players for the round
- Expose `roundGroups` and `roundGroupPlayers` state
- Add `selectedGroupId` state + `selectGroup(groupId)` setter
- When a group is selected, auto-populate `selectedPlayers` and `teamAssignments` from the group data
- In `startRound`: instead of creating a new group, update the existing group's `round_id` and set `status: 'active'`
- Remove player selection/toggle logic when groups exist (keep as fallback if no groups are pre-set)

### `src/components/tournament/TournamentBuildRoundWizard.tsx`
- Detect if pre-created groups exist for the selected round (`setup.roundGroups.length > 0`)
- **If groups exist**: Step 4 becomes "Select Your Group" — shows cards for each group with player names/teams. Player picks the group they're in. Step 5 (team assignment) is skipped entirely.
- **If no groups**: current flow remains as fallback
- Adjust `TOTAL_STEPS` dynamically (5 steps when groups pre-exist: confirm, round, course, group select, side games, review → 6 steps)
- `canProceed` for the group selection step: requires `selectedGroupId` to be set

### New component: `src/components/tournament/TournamentGroupSelector.tsx`
Shows pre-created groups as cards:
- Each card shows group number, player names with team colors
- Highlight the group containing the current user (if any)
- Click to select; selected state with border highlight

## Data Flow

```text
Admin Dashboard                          Player Wizard
┌──────────────────┐                    ┌──────────────────┐
│ Set Pairings     │                    │ Select Round     │
│ ┌──────────────┐ │                    │        ↓         │
│ │ Group 1      │ │  ──(DB)──────────► │ Select Group     │
│ │ A vs B, C, D │ │  tournament_groups │ [Group 1] [Grp2] │
│ └──────────────┘ │  + group_players   │        ↓         │
│ ┌──────────────┐ │                    │ Side Games       │
│ │ Group 2      │ │                    │        ↓         │
│ │ E vs F, G, H │ │                    │ Review & Start   │
│ └──────────────┘ │                    └──────────────────┘
└──────────────────┘
```

## Files Changed
1. **`src/components/tournament-admin/RoundPairingsEditor.tsx`** — New component for admin pairing management
2. **`src/components/tournament/TournamentGroupSelector.tsx`** — New component for player group selection
3. **`src/hooks/useTournamentDetail.ts`** — Add `groupPlayers`, `addGroup`, `deleteGroup`
4. **`src/pages/TournamentAdminDashboard.tsx`** — Add "Set Pairings" button in Overview round cards
5. **`src/hooks/useTournamentRoundSetup.ts`** — Fetch pre-set groups, add group selection, modify `startRound` to use existing group
6. **`src/components/tournament/TournamentBuildRoundWizard.tsx`** — Replace player selection with group selection when groups exist

