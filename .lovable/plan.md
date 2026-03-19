

# Analysis: Admin Changing Game Type Mid-Tournament

## What Currently Works

When the admin edits Round 3's game configuration before any player starts it:

1. **Database updates correctly** — `saveRoundEdits` in `TournamentAdminDashboard.tsx` updates both `tournament_rounds` (name, date, course, notes) and `tournament_games` (game_type, points, handicaps, etc.)
2. **Players see updated config** — `useTournamentRoundSetup.selectRound()` fetches fresh data from `tournament_games` and `tournament_rounds` when a player opens the Build Round Wizard. They will see the new game type, rules, and settings.
3. **Scoring engine adapts** — The tournament engine reads `game_type` from the `tournament_games` table at scoring time, so results will be calculated correctly for the new format.

## Identified Gap: Stale Admin Pairings

There is **one significant gap**. If the admin:
1. Creates Round 3 as **Best Ball (4-player groups)**
2. Sets up pairings (groups of 4 players each)
3. Later changes Round 3 to **Individual Match Play (2-player groups)**

The **existing pairings are NOT deleted or adjusted**. The `saveRoundEdits` function only updates the `tournament_rounds` and `tournament_games` rows — it does not touch `tournament_groups` or `tournament_group_players`.

This means:
- Groups of 4 players remain in the database
- The player wizard expects 2-player groups for the new game type (`requiredPlayerCount` = 2)
- Players selecting a pre-set group would get 4 players auto-populated into a 2-player format — causing a mismatch

### Other items that DO work correctly
- **Hole point overrides** — Not updated during edits (the `holePointOverrides` field in `saveRoundEdits` is skipped), but these are fetched fresh by the player wizard via `tournament_hole_points`
- **Side games** — Selected by each player independently in the wizard, unaffected by admin changes
- **Course data** — Updated in `tournament_rounds.course_data` and fetched fresh

## Proposed Fix

When the admin saves a round edit that **changes the game type**, and the new game type has a **different required player count** than the old one, automatically delete all existing groups and group players for that round. This prevents stale pairings from causing player count mismatches.

### Changes

**`src/pages/TournamentAdminDashboard.tsx`** — In `saveRoundEdits`, after detecting a game type change with a different player count:
- Query `tournament_groups` for the round
- Delete `tournament_group_players` for those groups
- Delete `tournament_groups` for the round
- Show a toast warning: "Pairings cleared — new game format requires different group sizes"

**`src/components/tournament-admin/RoundConfigCard.tsx`** — No changes needed (it's purely a form component)

### Technical Detail

```text
saveRoundEdits()
  ├── update tournament_rounds (name, date, course, notes)
  ├── update tournament_games (game_type, points, rules...)
  └── IF game_type changed AND player count differs:
        ├── DELETE tournament_group_players WHERE group IN round's groups
        ├── DELETE tournament_groups WHERE tournament_round_id = roundId
        └── toast.warning("Pairings cleared...")
```

This is a ~15 line addition to `saveRoundEdits`. The player count mapping already exists in `useTournamentRoundSetup.ts` as `GAME_TYPE_PLAYER_COUNT` and can be duplicated or imported.

