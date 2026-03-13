
Goal: fix the Team Banker hole-8 winner so it matches the selected rules (“Low man = 0” + 2nd-ball tiebreaker).

What I found
- The current round’s Team Banker metadata is corrupted on stretch 2 (hole 7 start):
  - `_META_HANDICAP_MODE: true`
  - `_META_USE_SECOND_BALL: "relative"`
- That means the two values were saved in swapped positions.
- Result: the engine treats handicap mode as absolute (because `true !== 'relative'`), which explains why hole 8 is incorrectly awarded to Brandon/Justin.

Implementation plan
1) Fix the write path (prevent future bad data)
- File: `src/components/ActiveRound.tsx`
- In `TeamBankerTeamSetup`’s `onConfirm` handler, correct parameter order to match the component contract:
  - `(..., useSecondBall, handicapMode, ...)` (currently reversed in handler args).

2) Add backward-compatible read normalization (fix existing rounds immediately)
- File: `src/services/teamBankerEngine.ts`
- In `getTeamBankerTeamAssignment`, normalize raw metadata before returning:
  - Detect legacy swapped shape (`_META_HANDICAP_MODE` is boolean and `_META_USE_SECOND_BALL` is `'absolute'|'relative'`), then swap in memory.
  - Strictly coerce `useSecondBallTiebreaker` to boolean.
  - Strictly validate `handicapMode` to `'absolute' | 'relative'`, with safe fallback.

3) Use normalized values wherever Team Banker settings are carried forward
- File: `src/components/ActiveRound.tsx`
- For stretch carry-forward defaults, read stretch 1 via `getTeamBankerTeamAssignment(...)` instead of raw `_META_*` fields, so legacy swapped rounds don’t propagate bad values.

Technical details
- No database migration required.
- This is a client logic fix only.
- Existing rounds with swapped metadata will evaluate correctly after normalization.
- Future rounds will save correct `_META_HANDICAP_MODE` and `_META_USE_SECOND_BALL` values.

Validation checklist
- Re-open current round, hole 8:
  - Team A (Josh/Kimball) nets: 4/4
  - Team B (Brandon/Justin) nets: 4/5
  - With 2nd-ball tiebreaker enabled, Team A wins.
- Verify both setup options still behave correctly:
  - “Low man = 0” (relative)
  - “Everyone gets a Stroke” (absolute)
