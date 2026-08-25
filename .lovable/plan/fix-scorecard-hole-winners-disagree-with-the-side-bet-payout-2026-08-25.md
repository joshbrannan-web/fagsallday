# Fix: scorecard hole winners disagree with the side-bet payout

## What you're seeing

On the Side Bets "Scorecard & Results" card, the HOLE WINNER row is computed by a rule that is **not** the rule the game itself uses to pay out.

- The scorecard row gives every player their full course-handicap stroke (Josh 11 strokes, Paul 8 strokes) and calls the lowest net the winner. On the front nine that produces Josh 4, Paul 4, one halved — 4.5 / 4.5.
- The payout engine uses each game's own handicap configuration. Most games (Nassau, Banker, Wolf, Nine Points) default to **relative** handicaps: only the strokes of the difference (Josh gets 3 strokes, on stroke-index 1-3 = holes 5, 12, 4), and FBO additionally cancels a stroke when both players get one. Under relative strokes the front nine is Josh 4, Paul 3, two halved — Josh wins the front.

Same nine holes, two different stroke rules, two different answers. The scorecard is the one that's out of step: it never looks at the selected game's handicap settings.

Verified against the real data: CGC 2026 Round 1, Josh Brannan (10.5) vs Paul Rakovich (8.1). Running the engine on those exact scores as FBO returns "Front 9: Push", so the front result shown depends entirely on which game is selected — and the scorecard row currently ignores that.

## The fix

Make the scorecard's hole winners come from the same engine that produces the money.

1. In `src/components/tournament/SideBetScorecardDialog.tsx`, stop computing winners with `calculateStrokesReceived` on the raw course handicap.
2. Derive per-hole strokes and winners from the selected game(s):
   - Read `useHandicaps` and `handicapMode` (`absolute` / `relative`) from the game config.
   - For FBO games reuse `getFBOHoleNetScores` / `calculateFBOHoleWinners` from `src/services/gameEngine.ts`, which already applies the FBO stroke rules including cancellation.
   - For non-FBO games apply the shared stroke helper in the same mode the game uses (relative = strokes off the low handicap in the selected group; absolute = full course handicap; no strokes when `useHandicaps` is false).
3. Show the net numbers and the gold stroke dots from that same calculation, so the small net numbers on the card always explain the highlighted winner.
4. When more than one game is selected with different handicap rules, label the scorecard with which game's rules it is showing and add a small selector so the user can switch (default: the first game).
5. Add a one-line footnote under the card stating the handicap rule in force, e.g. "Net scores use relative handicaps: Josh gets 3 strokes (holes 5, 12, 4)."

No changes to payout math — only the scorecard display is corrected so it matches the payouts.

## Technical notes

- Files touched: `src/components/tournament/SideBetScorecardDialog.tsx` only (plus a small exported stroke helper in `src/services/gameEngine.ts` if one isn't already reusable).
- `buildSideBetRound` already returns the normalized round/players, so the dialog has everything needed to call the engine helpers directly.
