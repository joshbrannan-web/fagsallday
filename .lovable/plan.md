

# Plan: Tournament Round Delete on Round Summary Page

## Approach

Instead of adding a delete button to the ActiveRound header, modify the existing `handleDeleteRound` in `RoundSummary.tsx` to also clean up tournament data when the round is a tournament round. The delete button already exists on the summary page for non-tournament active rounds — just need to ensure it also appears for tournament rounds and handles the tournament cleanup.

## Changes

### 1. `src/components/RoundSummary.tsx`

- **Show the Delete button for tournament rounds too**: Currently the Delete Round button is inside `!allHolesComplete && currentRound.status === 'ACTIVE'` block. Tournament rounds should also show delete here (the button already renders for active rounds regardless of tournament status — just need to verify it's not hidden).
- **Update `handleDeleteRound`**: When `tournamentGroupId` is present, replace the `window.confirm` with an `AlertDialog` showing the custom message: *"If you delete this round, all round info fed to tournament will be lost. Are you sure you want to delete?"*
- Before deleting the round, delete tournament child records: `tournament_group_players`, `tournament_hole_scores`, `tournament_hole_results` for the group, then delete the `tournament_groups` row itself.
- Then call `deleteRound(currentRound.id)` and navigate home as usual.
- Add `AlertDialog` imports and state (`showDeleteConfirm`) to manage the dialog.

### 2. Database Migration

Add DELETE RLS policies so group members can delete their own tournament group data:

```sql
-- tournament_groups
CREATE POLICY "Group members can delete their groups"
ON public.tournament_groups FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_groups.id
  AND tp.user_id = auth.uid()
));

-- tournament_group_players
CREATE POLICY "Group members can delete group players"
ON public.tournament_group_players FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp2
  JOIN tournament_players tp ON tp.id = tgp2.tournament_player_id
  WHERE tgp2.tournament_group_id = tournament_group_players.tournament_group_id
  AND tp.user_id = auth.uid()
));

-- tournament_hole_scores
CREATE POLICY "Group members can delete hole scores"
ON public.tournament_hole_scores FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_hole_scores.tournament_group_id
  AND tp.user_id = auth.uid()
));

-- tournament_hole_results
CREATE POLICY "Group members can delete hole results"
ON public.tournament_hole_results FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM tournament_group_players tgp
  JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
  WHERE tgp.tournament_group_id = tournament_hole_results.tournament_group_id
  AND tp.user_id = auth.uid()
));
```

## Summary

| Resource | Change |
|---|---|
| `src/components/RoundSummary.tsx` | Replace `window.confirm` with `AlertDialog` for tournament rounds; add tournament data cleanup before round deletion |
| Database migration | Add DELETE RLS policies on 4 tournament tables for group members |

1 file modified, 1 database migration, 0 new files.

