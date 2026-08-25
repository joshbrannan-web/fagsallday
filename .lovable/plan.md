# Side Bets: hole-by-hole scorecard for the betting players

Let players who ran a side bet see a shared scorecard — as if the selected players played together — with per-hole results.

## What changes

- In the Side Bets results area, add a "Scorecard" step: checkboxes to pick any of the players who were in the side bet (default: all of them).
- A "View Scorecard & Results" button opens a full-screen dialog containing:
  - A true scorecard grid: holes across the top (Out / In / Total columns), one row per selected player, gross score with net score beneath, par and yardage rows.
  - Handicap stroke markers (gold dot) on holes where a player gets a stroke, same convention used in the tournament scorecards.
  - Per-hole result row for each game in the bet: who won the hole (or a half), with the winning player's cell highlighted.
  - A footer summary per game: running result and each player's money total, plus the who-owes-who lines already computed.
- Only holes where every selected player has a score are treated as played; unplayed holes show blank.
- Reset behaviour is unchanged — resetting clears the scorecard selection too.

## Technical notes

- New component `src/components/tournament/SideBetScorecardDialog.tsx`, rendered from `SideBetsPanel.tsx` inside the existing results block.
- Data comes from what the panel already has: `round.course_data` (holes/par/yardage), the selected `SideBetPlayerInput` list, and the fetched `tournament_hole_scores` rows. No new queries.
- Reuse `buildSideBetRound` from `src/services/sideBets.ts` to get the synthetic `Round` (course handicaps, net scores, hydrated per-hole game metadata) for the chosen player subset, so per-hole winners come from the same engine that computes the payouts. `buildSideBetRound` is already exported; if a per-hole winner helper is needed it will be read from the existing `gameEngine` exports rather than reimplemented.
- Payout numbers in the dialog footer come from `calculateSideBets` for the chosen subset — no scoring rules change.
- Nothing is persisted; this is presentation only. No database, RLS, or engine changes.
