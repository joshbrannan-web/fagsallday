# Side Bets in Tournaments

Add a Side Bets tab so people can run informal money games (Skins, Nassau, Banker, Wolf, Nine Points, FBO, etc.) between any 2-4 players inside a tournament round, see who owes who, and reset to try a different combination.

## How it works for the user

1. Open the tournament (admin dashboard or the player tournament view) and go to **Side Bets**.
2. Pick a round from the tournament — the side bet uses the gross scores already recorded for that round.
3. Pick 2, 3, or 4 players from the tournament roster.
4. Pick a game and set the bet exactly like the normal game setup (unit stake, handicaps on/off, game-specific options).
5. See results: per-hole detail where the game supports it, per-player totals, and a "who owes who" settlement summary.
6. **Reset** clears the selection so a new round/players/game can be set up.

Nothing is saved — side bets live in the current browser session only. Reloading or leaving the tab clears them. Any tournament viewer can build one; results are computed from the same scores everyone can already see.

## Technical approach

New files:
- `src/components/tournament/SideBetsPanel.tsx` — the whole flow: round picker, player multi-select (2-4, reuse the visual style of `TournamentPlayerSelector`), game picker via `GameSelector`, results, Reset button. Local `useState` only.
- `src/services/sideBets.ts` — builds a synthetic `Round` object (course from `tournament_rounds.course_data`, `players` from the selected tournament players with their effective handicap `handicap_override ?? handicap_index`, `scores` mapped from `tournament_hole_scores` gross scores keyed by hole) and runs it through the existing `calculatePerGameTotals` in `src/services/gameEngine.ts`. Also derives the owes-who settlement using the existing greedy settlement helper used by round summaries.

Edits:
- `src/pages/TournamentAdminDashboard.tsx` — add a sixth `TabsTrigger`/`TabsContent` ("Side Bets"), grid becomes `grid-cols-6`, render `SideBetsPanel`.
- `src/pages/Tournament.tsx` — surface the same panel for players in the tournament view.
- `GameSelector` is reused as-is; tournament-mode restrictions on rotating-team games (6's, 3's, Stockton 6's) stay in force, and games are filtered by the selected player count via each library entry's `minPlayers`/`maxPlayers`.

No database changes, no writes to tournament scoring tables — the panel is read-only against existing scores.

## Notes / limits

- Players with no scores entered for the chosen round show as incomplete; games compute only over holes where all selected players have a score.
- Because this is session-only, two people looking at the same tournament each build their own side bet independently.
