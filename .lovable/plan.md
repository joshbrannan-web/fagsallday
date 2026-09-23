# Wolf for 4 to 8 Players

Today Wolf only works with exactly 4 players — the setup screen won't let you add a 5th, and scoring returns "Wolf requires exactly 4 players". This opens Wolf up to groups of 4 through 8 while keeping the game identical: the Wolf rotates each hole and either picks one partner or goes it alone against everyone else.

## How it will play

- Group of 5 to 8: the Wolf rotates hole by hole through the whole group, same as now.
- Wolf picks one partner: that's 2 against the rest (2v6 in an eight-player group).
- Lone Wolf or Blind Lone Wolf: 1 against the whole field (1v7 in an eight-player group).
- Each side's score on the hole is its best net ball, as today.

## Money

Per-opponent wagering, so every hole balances to zero:

- Lone Wolf wins: 2 units from every opponent (Blind Lone Wolf: 4 units). An eight-player Blind win pays 28 units.
- Lone Wolf loses: pays 2 units (Blind: 4) to every opponent.
- Wolf + partner win: each opponent pays 2 units; the Wolf and partner split the pot evenly.
- Wolf + partner lose: each opponent wins 3 units; the Wolf and partner split the loss evenly.
- Tie on the hole: push, no money moves.

## Screens

- Setup: Wolf becomes selectable with 4 to 8 players, with its description and "ideal players" text updated.
- Active round, hole view: the Wolf banner stays the same; the partner picker lists every other player in the group (scrollable when there are 7 options) and Lone Wolf reads "Lone Wolf (1 v N)" for the actual field size. The team recap under it shows the Wolf side and the full opponent list.
- Round summary and scorecard: Wolf hole lines and per-player totals already read from the calculated results, so they follow automatically; hole detail text will name the opponent count instead of assuming 3.

## Technical notes

- `src/lib/gameLibrary.ts`: Wolf `maxPlayers` 4 → 8, refresh description and `GAME_DETAILS` ideal-players/example payout.
- `src/services/gameEngine.ts` `calculateWolf`: replace the `players.length !== 4` guard with a 4–8 range check; keep team construction as-is (it already derives opponents by exclusion). Rewrite the award block to per-opponent wagering: winning/losing amounts computed as `points * opponentCount * unit` on the Wolf side and `points * unit` per opponent for Lone Wolf; for the partner case the opponents settle `±2` (win) / `±3` (loss) each and the Wolf pair splits the aggregate evenly. Round each player's hole amount to the nearest cent.
- `src/components/ActiveRound.tsx`: Wolf rotation index already uses `players.length`, so rotation works unchanged; partner buttons map over all non-Wolf players in a wrapping/scrolling grid, Lone Wolf label uses the live opponent count.
- `src/components/GameSelector.tsx` / `SetupWizard.tsx`: no logic change expected beyond the library bounds; verify Wolf is not filtered out by any hardcoded 4-player check.
- `src/services/gameEngine.test.ts` style checks: add cases for a 6-player partner hole and an 8-player Blind Lone Wolf hole confirming the hole nets to zero.
