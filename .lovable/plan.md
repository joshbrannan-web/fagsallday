
Root cause (confirmed from backend + network):
- Clark Kent’s round `33cb0d8d-...` is still linked to tournament group `9d7d7ba1-...` in `tournament_groups.round_id`.
- Delete request fails with `23503` FK constraint (`tournament_groups_round_id_fkey`) because that group row still references the round.
- The round is being treated as “non-tournament” in UI because `rounds.game_data` currently has no `_TOURNAMENT_META`, so the tournament cleanup path is skipped and direct round delete is attempted.

Plan to fix:
1) Make delete logic tournament-safe even when `_TOURNAMENT_META` is missing
- In `RoundSummary` (or centralized in `useRounds.deleteRound`), before direct delete:
  - Query `tournament_groups` by `round_id = currentRound.id`.
  - If found, run tournament cleanup (hole results, hole scores, group players, group) then delete round.
  - If not found, perform normal round delete.
- This removes dependency on metadata for safe deletion.

2) Prevent tournament metadata loss on “Change Games”
- In `App.tsx` `changeGames(...)`, preserve existing `_TOURNAMENT_META` when replacing `gameData`.
- In `SetupWizard` change-games flow, ensure updated `initialGameData` is merged with preserved tournament meta, not replaced.

3) Harden tournament detection
- In `RoundSummary`, compute tournament context using:
  1) route state
  2) `_TOURNAMENT_META`
  3) fallback lookup by `round_id` in `tournament_groups`
- This ensures tournament actions/buttons stay correct even if metadata is partially missing.

Technical details:
- No schema change required.
- Current FK behavior is correct; app behavior is the issue.
- Keep group isolation intact: cleanup targets only the group tied to the current round id.

Validation checklist:
- Reproduce with Clark’s round: delete now succeeds.
- Non-tournament active round delete still works.
- Tournament round with intact `_TOURNAMENT_META` still follows existing delete confirmation flow.
- “Change Games” in a tournament round no longer removes tournament resume/delete behavior.
