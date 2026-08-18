# Test Start mirrors the real round

Today Test Start creates one ad-hoc group with hand-picked players and deliberately turns off round-level and cross-group scoring, so it doesn't exercise the round the admin actually built. Change it so Test Start clones the round exactly — same game and settings, same pairings/groups, same cross-group matches — into an isolated test sandbox.

## What the admin sees

1. On a round card, **Test Start** opens a confirmation sheet that shows what will be cloned: the game format, the number of groups and their players, and the cross-group matches defined for that round.
2. Launching creates a test copy of every group in the round (with the same players, team assignments, group numbers, and leaders) plus a test copy of every cross-group match.
3. A **Test Console** view lists all test groups. The admin can open any group's scorecard, punch in scores for any player, and jump between groups — no need to be a member of the group.
4. Scoring, status bars, match results and round-level pooled formats (Gross Best Ball 6/6/6, cross-group 2v2) behave exactly as they will live, but computed only from test data.
5. **Reset Test** wipes every test group, test match, test score/result and the linked practice `rounds` rows, returning the round untouched. Test Start can then be run again.

If the round has no pairings set yet, Test Start says so and points the admin to Set Pairings first (falling back to a manual player picker is not part of this).

## Isolation rules (unchanged)

- Test groups, matches, scores and hole results never appear on scoreboards, standings, live view, round results, or the player hub.
- Test Start never activates the round or the tournament.
- Only tournament admins can launch, view or reset a test.

## Technical approach

**Migration**
- Add `is_test boolean not null default false` to `tournament_round_matches`.
- Add nullable `source_group_id uuid` / `source_match_id uuid` on the test rows so clones can be traced back (used for match ↔ group remapping during the clone).

**Clone service (`src/services/testRounds.ts`)**
- `startTestRound(tournamentRoundId)`:
  - reads real `tournament_groups` + `tournament_group_players` + `tournament_round_matches` for the round,
  - inserts test copies of each group (`is_test: true`, same `group_number`, `team_matchup`, `leader_player_id`) and their players,
  - inserts test copies of matches with player/team payloads remapped to the cloned group ids,
  - creates one `rounds` row per test group with `_TOURNAMENT_META` carrying `isTest: true`, the test group id and player mapping (no `round_participants`, no activation writes).
- `resetTestRound` extended to also delete test `tournament_round_matches`.

**Make scoring test-aware instead of test-blind**
- `buildRoundLevelContext(roundId, { isTest })` in `src/services/roundLevelScoring.ts`: filter groups by `is_test = <scope>` and matches by the same flag, so a test group pools across the other *test* groups and uses the cloned match definitions.
- `src/hooks/useTournamentScorecard.ts` and `src/hooks/useTournamentOverlay.ts`: instead of disabling round-level/cross-group scoring for test groups, pass `isTest: true` into the context builder.
- Read paths that aggregate for real standings (`useTournamentScoreboards`, `useTournamentDetail`, `useTournamentGroups`) keep their `is_test = false` filters.

**Admin UI**
- Rewrite `src/components/tournament-admin/TestRoundLauncher.tsx` as a clone-preview + launch/reset sheet (drops the manual player checklist).
- New `src/pages/TournamentAdminTestConsole.tsx` (route `/tournament-admin/:tournamentId/test/:roundId`): lists test groups with player names and thru counts, links into the existing admin group scorecard for score entry, and holds Reset Test.
- `src/components/tournament/TestRoundBanner.tsx` keeps the gold TEST banner and gains a link back to the Test Console.
