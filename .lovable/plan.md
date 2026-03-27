

# Tournament Admin Enhancements — 4 Features

## 1. Admin Score Editor (Batch Save)

**Current state**: `GroupScorecardAdmin` auto-saves each cell on blur via `overrideScore()`. The user wants a batch-save pattern instead.

**Changes**:
- **`src/components/tournament-admin/GroupScorecardAdmin.tsx`** — Replace single-cell auto-save with a local draft state (`pendingEdits: Map<key, number>`). Remove `onBlur={saveEdit}`. Add a "Save All" button that calls `onOverrideScore` for each pending edit, then clears the draft. Show a dirty-state indicator (badge count or highlight changed cells).
- **`src/pages/TournamentAdminScorecard.tsx`** — Update to pass a batch-save handler instead of per-cell. The handler loops through all changed scores, calls `overrideScore` for each, then triggers engine recalculation once at the end.
- **`src/hooks/useTournamentScorecard.ts`** — Add a `batchOverrideScores(edits: {playerId, hole, score}[])` function that upserts all scores in one call, then runs the engine once. This replaces calling `overrideScore` N times.

## 2. Auto-Link Players on Tournament Add

**Current state**: `PlayerListAdmin.handleAdd()` calls `onAddPlayer` which inserts into `tournament_players`. No cross-linking between players' "My Players" lists.

**Changes**:
- **`src/hooks/useTournamentDetail.ts` → `addPlayer()`** — After inserting the tournament player, if the new player has a `user_id`, loop through all OTHER tournament players that also have a `user_id` and call `supabase.rpc('link_players_bidirectional')` for each pair. This ensures all linked players in the tournament see each other in "My Players".
- Same logic runs during tournament creation in **`src/hooks/useTournaments.ts`** → `createTournament()` — after all players are inserted, cross-link all pairs with `user_id`s.

## 3. Group Leader / Designated Scorekeeper

**Current state**: The first person to start a round via the wizard becomes the `rounds.user_id` (owner). Other players who join the same group see a read-only view. There's no way for the admin to designate who should be the owner.

**Changes**:
- **Database migration** — Add `leader_player_id UUID` column to `tournament_groups` table (nullable, references a tournament_player_id conceptually but no FK needed).
- **`src/components/tournament-admin/RoundPairingsEditor.tsx`** — After selecting players for a group, add a "Group Leader" dropdown (select one of the selected players). Pass the selected leader ID to `onAddGroup`. Display the leader with a small crown/star icon in the existing group cards.
- **`src/hooks/useTournamentDetail.ts` → `addGroup()`** — Accept optional `leaderPlayerId` param, include it in the group insert.
- **`src/hooks/useTournamentRoundSetup.ts` → `startRound()`** — When a pre-assigned group is selected, check if `group.leader_player_id` is set. If the current user's tournament player ID does NOT match the leader, block round creation and show a toast: "Only the designated scorekeeper can start this round. Ask [leader name] to start scoring." This prevents non-leaders from taking ownership.

## 4. 1v1 Games with Groups of 2 or 4

**Current state**: Already implemented. `RoundPairingsEditor` supports selecting 2 or 4 players for 1v1 game types. When 4 are selected, a matchup assignment step appears. When 2 are selected, it saves directly. This feature is already working as described — no changes needed.

## Summary

| File | Change |
|------|--------|
| `src/components/tournament-admin/GroupScorecardAdmin.tsx` | Batch edit with local draft state + Save All button |
| `src/pages/TournamentAdminScorecard.tsx` | Wire up batch save handler |
| `src/hooks/useTournamentScorecard.ts` | Add `batchOverrideScores()` |
| `src/hooks/useTournamentDetail.ts` | Cross-link players in `addPlayer()` |
| `src/hooks/useTournaments.ts` | Cross-link players in `createTournament()` |
| `src/components/tournament-admin/RoundPairingsEditor.tsx` | Add group leader selector |
| `src/hooks/useTournamentRoundSetup.ts` | Block non-leader from starting pre-assigned group rounds |
| **Migration** | Add `leader_player_id` column to `tournament_groups` |

3 new features, 7 files changed (+ 1 migration), 1 feature already complete.

