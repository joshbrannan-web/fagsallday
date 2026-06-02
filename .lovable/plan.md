# Add Home Run Rule to Nine Points (Baseball)

Adds an optional "Home Run" rule: when a single player wins a hole outright by **2 or more net strokes**, that player sweeps all 9 points (others get 0). Toggle is off by default; users enable it in the Setup Wizard when picking Nine Points.

## 1. Type updates — `src/types.ts`
Extend `GameSettings['config']` with an optional `ninePoints` block:
```ts
ninePoints?: { homeRunEnabled: boolean };
```

## 2. Default config — `src/lib/gameLibrary.ts`
On the `NINE_POINTS` entry, set default config to include `ninePoints: { homeRunEnabled: false }` and update the description to mention the optional Home Run rule. Add a short note to `GAME_DETAILS[NINE_POINTS].howItWorks` describing Home Run.

## 3. Setup wizard toggle — `src/components/GameSelector.tsx`
Add a per-game config block (mirroring the Skins "Carryovers" switch pattern) shown only when `game.type === GameType.NINE_POINTS`:
- Label: **Home Run (win by 2+)**
- Helper text: *"If a player wins a hole outright by 2 or more net strokes, they sweep all 9 points."*
- `Switch` bound to `selectedGame.config.ninePoints?.homeRunEnabled ?? false`, updates via `updateGameConfigDeep`.

## 4. Scoring logic — `src/services/gameEngine.ts` (`calculateNinePoints`)
After sorting `netScores` ascending, before the existing tie/no-tie distribution:
- If `homeRunEnabled` is true AND `first.net !== second.net` (no tie for low) AND `(second.net - first.net) >= 2`, award `{ first: 9, second: 0, third: 0 }` and push detail line `"Hole H: <name> HOME RUN — wins by Xstrokes, 9 pts"`.
- Otherwise fall through to existing 5-3-1 / tie distribution.

The zero-sum subtraction at the end already handles the new distribution correctly (still totals 9 per played hole).

## 5. No DB / no edge function changes
The rule lives entirely in client config + scoring engine. Existing rounds without the flag default to `false` (current behavior preserved).

## Notes / assumptions
- "Wins by 2+" uses **net** strokes (consistent with the rest of Nine Points scoring). If you want gross-only, say so and I'll flip it.
- Tournament round wizard (`TournamentBuildRoundWizard`) reuses `GAME_LIBRARY` defaults, so the toggle will need an equivalent surface there only if you also want it exposed in tournament setup — let me know and I'll add it.
