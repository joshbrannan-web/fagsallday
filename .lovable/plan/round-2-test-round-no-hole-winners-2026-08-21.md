# Round 2 test round: no hole winners

## What's actually wrong

Verified in the database for this test round:

- Test scores: 144 rows present (8 players x 18 holes) — the scorecard data is complete.
- Test hole results: 0 rows — nothing has been computed.

That's why every hole shows "—", each match reads "All Square - Thru 0", and the Round Points Award card shows "hole pts 0 - 0 / in progress".

The cause: when the two real 2v2 matches were mirrored into the test sandbox, the old per-foursome result rows were cleared (they were computed against the wrong matchups). Results are only written by an explicit recalculation pass, and that pass has not run since. The scores are intact — the winners just haven't been derived yet.

## Fix

1. Run the existing recalculation for this test round so hole winners, match status, and the Front/Back/Overall award are derived from the 144 scores already stored, now against the correct 2v2 matchups.
2. Make this state self-healing: when a test scorecard or the Test Console loads and finds scores present but zero result rows, recalculate automatically instead of rendering an empty card.
3. Show a clear state instead of a silent zero: if results are still missing after loading, display "Results not calculated yet — Recheck" rather than "All Square - Thru 0", which reads as a legitimate tie.

## Technical notes

- Recalc entry point: `recalcTestRoundResults` in `src/services/testRounds.ts`. With test matches present it routes to `recalcRoundMatchResults(roundId, { isTest: true })`, which writes rows keyed by `tournament_match_id`.
- Auto-heal hook: in `src/pages/TournamentAdminTestScorecard.tsx` and `src/pages/TournamentAdminTestConsole.tsx` load paths, compare test score count vs test result count and trigger one recalc when scores exist and results are empty (guarded so it runs at most once per load).
- Empty-state copy lives in `src/components/tournament-admin/TestScorecardSection.tsx` (match header line) and `TestRoundAwardCard.tsx` (segment rows).

After this, the scorecard should show per-hole winners with tinted counting scores, real match standings, and the 2/2/2 F/B/O points for Round 2.
