# Test Start for a Tournament Round

Let tournament admins launch a throwaway "test" version of a round, punch in fake scores to confirm the game format and scoring work, then reset it and run the test again — with zero impact on real standings.

## How it works for the admin

1. In the admin dashboard, each round gets a **Test Start** action next to Set Pairings.
2. Choosing Test Start opens a small setup sheet: pick the players for a test group (pre-filled with the round's first pairing/match if one exists, otherwise the first N tournament players for the format), then launch.
3. The round opens in the normal scoring flow with a clear orange **TEST ROUND** banner, so scoring, status bars, and match logic behave exactly as they would live.
4. Optional convenience: a **Fill Random Scores** button in the test banner drops plausible scores on every hole so the admin can jump straight to the result.
5. When done, **Reset Test** wipes all test scores, results, groups and the underlying round, returning the round to its previous state. Test Start can then be run again from scratch.

## Isolation rules

- Test data is fully isolated: test hole scores, hole results and groups never appear on scoreboards, standings, the live view, round results dashboard, or the player hub.
- Starting a test never flips the tournament round from pending to active, and never flips the tournament from setup to active.
- Only tournament admins see or can trigger Test Start / Reset Test.

## Technical approach

**Data model (migration)**
- Add `is_test boolean not null default false` to `tournament_groups` and to `tournament_hole_results` (results created for a test group carry the flag).
- Test rounds in the `rounds` table are marked inside `game_data._TOURNAMENT_META` with `isTest: true` (no schema change needed there).
- Existing RLS policies already cover these tables; grants unchanged since no new tables are created.

**Filtering**
- Every read path that aggregates tournament scoring filters `is_test = false`:
  - `src/hooks/useTournamentScoreboards.ts` (group + hole result fetches)
  - `src/services/scoreboardCalculations.ts` consumers
  - `src/hooks/useTournamentDetail.ts` group/pairing counts and round results
  - `src/components/tournament-admin/RoundResultsDashboard.tsx`, `src/pages/TournamentAdminLiveView.tsx`
  - `src/services/roundLevelScoring.ts` pooled score/result queries so test scores are never pooled into a round-level or cross-group match calc; test groups recalc against their own group only.

**Start path**
- Extend `src/hooks/useTournamentRoundSetup.ts` with a `startRound({ test: true })` option that:
  - creates the group with `is_test: true`,
  - writes `isTest: true` into `_TOURNAMENT_META`,
  - skips the round/tournament auto-activation branches.
- New admin component `src/components/tournament-admin/TestRoundLauncher.tsx` (sheet with player picker + launch) wired into the round row in `src/pages/TournamentAdminDashboard.tsx`.

**Test banner + reset**
- New `src/components/tournament/TestRoundBanner.tsx` rendered in the active round / group scorecard views when `_TOURNAMENT_META.isTest` is true, holding the Fill Random Scores and Reset Test actions.
- Reset runs a scoped cleanup (delete `tournament_hole_scores`, `tournament_hole_results`, `tournament_group_players`, the test `tournament_groups` rows for that round, and the linked `rounds` row), guarded by an `AlertDialog`, then navigates back to the admin dashboard.
