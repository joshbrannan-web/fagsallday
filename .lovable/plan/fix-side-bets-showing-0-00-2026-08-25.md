# Fix Side Bets Showing $0.00

Side Bets currently finds the tournament scores, but FBO results can still show all $0.00 because the tournament side-bet round is synthetic and has no per-hole FBO result metadata. The shared FBO calculator settles payouts from stored dots (`dots`, `matchupDots`, or `teamDot`) instead of deriving those dots directly during final payout calculation.

I also checked the CGC 2026 tournament data: each tournament round has 18 holes and 144 gross score rows, so this is not a missing-score issue for the full rounds.

## What to change

1. Update the Side Bets calculation service so it builds the per-hole game metadata needed by games that require it before calling the shared game engine.
2. For FBO side bets:
   - All Together: compute each hole's winning player dot from the selected players' scores.
   - Head to Head: compute each selected 1v1 matchup's per-hole winner.
   - Teams 2v2: compute each hole's winning team, including the 2nd-ball tiebreaker setting.
3. Keep the calculation session-only: no database writes and no changes to tournament scoring data.
4. Add defensive validation so the UI gives a clear message if a selected game mode is missing required setup, like FBO Teams without two teams of two.
5. Verify with a side-bet FBO scenario using existing tournament scores that totals and “Who Owes Who” are no longer all $0.00 when one player/team actually wins Front, Back, or Overall.

## Technical notes

- Main file to update: `src/services/sideBets.ts`.
- It should continue creating a temporary `Round`, but populate `round.gameData[game.id][hole]` for FBO before `calculatePerGameTotals(round)` runs.
- No backend migration is needed.
