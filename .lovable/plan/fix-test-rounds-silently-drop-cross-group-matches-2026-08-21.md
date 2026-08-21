# Fix: test rounds silently drop cross-group matches

Your Round 2 matches **were** saved. Both 2v2 matches exist on the real round (created 11:22 today):

```text
Match 1  Erik Jensen + Kurt Saulnier        vs  Jeff Sahid + Scott Willett
Match 2  Paul Rakovich + Steve Vanzetti     vs  Grant Donaldson + Josh Brannan
```

The Test Start you ran at 11:25 tried to clone them into the test sandbox and the insert was rejected, so the test round has zero matches and fell back to per-foursome scoring — which is why hole 1 looked like 3 players vs 1.

## Root cause

`tournament_round_matches` has a unique constraint on `(tournament_round_id, match_number)` that ignores `is_test`. Test clones reuse the same round id and the same match numbers, so cloning Match 1 collides with the real Match 1 and the whole insert fails. `startTestRound` does not check that insert's error, so Test Start reported success anyway.

## What gets fixed

1. **Database**: replace the unique constraint with `(tournament_round_id, is_test, match_number)` so a test copy of Match 1 can coexist with the real Match 1.

2. **Test Start**: check the match-clone insert result and fail loudly (`Failed to clone round matches`) instead of silently producing a match-less test round, so this can never pass unnoticed again.

3. **Test Console**: when the round has real cross-group matches but the running test has none, show an amber notice telling you to reset and re-run Test Start.

4. **Your Round 2 test**: reset the current test and re-run Test Start so it mirrors both matches. After Fill All Scores, the Test Scorecard shows two 2v2 match cards with per-hole winners and the F/B/O award (2 pts front / 2 back / 2 overall).

## Technical notes

- Migration: `ALTER TABLE public.tournament_round_matches DROP CONSTRAINT tournament_round_matches_tournament_round_id_match_number_key;` then `ADD CONSTRAINT tournament_round_matches_round_test_number_key UNIQUE (tournament_round_id, is_test, match_number);`
- `src/services/testRounds.ts` step 3: capture `{ error }` from the `tournament_round_matches` insert and throw; keep the existing reset path so a partial test can be cleaned up.
- `src/pages/TournamentAdminTestConsole.tsx`: compare `fetchRoundMatches(roundId, { isTest: false })` count against the test match count and render the stale-test notice.
- No scoring-engine changes: `recalcRoundMatchResults` already pools scores round-wide per match and clears group-level rows, so once the test matches exist the scorecard and awards are correct.
