# Fix: all scores still highlighted on 2v2 match-play scorecards

## What's happening

The highlight logic added last round is correct, but it never runs for this round. The scorecard pages tell the component how many balls count per hole using the Gross 6/6/6 rule — 2 balls on holes 1-6, 3 balls on 7-12, 4 balls on 13-18 — and they apply that rule to *any* game whose type contains `best_ball`.

Round 2 is `match_play_best_ball`, so the pages hand the component "2 to 4 balls count". The component sees a count greater than 1, takes the multi-ball path, and highlights every player's score. The single-deciding-ball path (with the 2nd-ball tiebreaker) is skipped entirely.

## The fix

Only apply the 6/6/6 balls-counted rule to the Gross 6/6/6 game type. For `match_play_best_ball`, pass no per-hole ball count so the component falls back to its deciding-ball logic:

- one ball highlighted per side when the best nets differ
- two balls per side only when the best nets tie and the 2nd-ball tiebreaker decides the hole

## Technical details

- `src/pages/TournamentAdminTestScorecard.tsx` (line ~178) and `src/pages/TournamentAdminRoundScorecard.tsx` (line ~169): gate `ballsCounted` on the 6/6/6 game type rather than on `bestBall`, so it is `undefined` for `match_play_best_ball`.
- No change to `TestScorecardSection.tsx` — its `countingIds` logic already handles both cases.
- Verify against CGC 2026 Round 2 test scorecard: hole 2 should highlight only Erik Jensen (net 1) and Scott Willett (2); partners dimmed. Team net footer rows should follow the same single-ball values.
