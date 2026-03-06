

# Tournament Scoring Audit — Findings & Fix Plan

## Bug Found: Cumulative `playerPoints` in Team Game Formats

**Severity: High — produces inflated scores on Individual Points scoreboard**

In `src/services/tournamentEngine.ts`, the team-format game calculators (`calcMatchPlayBestBall`, `calcGrossBestBall`, `calcScramble`) store **cumulative running totals** in `playerPoints` for each hole result, instead of per-hole values.

```text
Example: 3-hole match, Team A wins each hole (1pt each)

Current (wrong):
  Hole 1 playerPoints: { playerA: 1 }
  Hole 2 playerPoints: { playerA: 2 }  ← cumulative
  Hole 3 playerPoints: { playerA: 3 }  ← cumulative

  calcPlayerPointsPerRound sums these → 1+2+3 = 6 (WRONG)

Expected:
  Hole 1 playerPoints: { playerA: 1 }
  Hole 2 playerPoints: { playerA: 1 }  ← per-hole
  Hole 3 playerPoints: { playerA: 1 }  ← per-hole

  calcPlayerPointsPerRound sums these → 1+1+1 = 3 (CORRECT)
```

The root cause is lines like 316 in `calcMatchPlayBestBall`:
```ts
playerPoints: { ...playerTotals },  // playerTotals accumulates across the loop
```

This value gets persisted to the `tournament_hole_results` table (via `useTournamentScorecard.ts` line 197) and then consumed by `calcPlayerPointsPerRound` in the Individual Points scoreboard, which sums the already-cumulative values — double counting.

**Individual Match Play is NOT affected** — it correctly stores per-hole values.

### Fix

In `src/services/tournamentEngine.ts`, change three functions to store per-hole player points instead of cumulative totals:

1. **`calcMatchPlayBestBall`** (~line 316): Replace `{ ...playerTotals }` with a fresh object that maps each team's players to that hole's points (aPts/bPts)
2. **`calcGrossBestBall`** (~line 401): Same fix
3. **`calcScramble`** (~line 476): Same fix

Each fix replaces the spread of cumulative `playerTotals` with:
```ts
const holePlayerPoints: Record<string, number> = {};
(teamPlayers[teamAId] || []).forEach(p => { holePlayerPoints[p.id] = aPts; });
(teamPlayers[teamBId] || []).forEach(p => { holePlayerPoints[p.id] = bPts; });
// ...
playerPoints: holePlayerPoints,
```

## Minor Issue: Missing Guard for Plus-Handicap Players in Net Scoreboard

In `src/services/scoreboardCalculations.ts` `calcPlayerNetPerRound` (line 155-157), there is no guard for `courseHandicap <= 0`. The tournament engine (`strokesReceived`) has `if (courseHandicap <= 0) return 0`, but the scoreboard calculation doesn't. With a negative course handicap, `Math.floor` and `%` on negative numbers in JS produce unexpected results, giving wrong net scores for plus-handicap players.

**Fix**: Add the same guard in the strokes calculation within `calcPlayerNetPerRound`.

## Everything Else Checks Out

- **Tournament Engine**: All 9 game types dispatch correctly. Handicap stroke distribution (base + remainder), max score capping, halved-hole rules, second-ball tiebreaker, Sixes sum-of-strokes segments — all mathematically sound.
- **Match State**: Close-out detection (`diff > holesRemaining`), dormie, and result labels are correct. Completed tied match correctly labeled "Halved".
- **Scoreboard Calculations**: `calcTeamTotals`, `calcTeamTotalsPerRound`, `calcPlayerGrossPerRound`, `rankWithTies`, `calcThru`, `calcPointsToWin` — all correct.
- **Scoreboard Components**: All 6 types render correctly using the calculation service. Ranking borders, tie prefixes, override indicators all work.
- **Realtime Hook**: `useTournamentScoreboards` correctly subscribes to scores, results, and round changes. Incremental updates are merged correctly.
- **Test Suite**: 35 tests cover core engine logic.

## Summary

| File | Change |
|------|--------|
| `src/services/tournamentEngine.ts` | Fix `playerPoints` in 3 team-game functions + add guard |
| `src/services/scoreboardCalculations.ts` | Add `courseHandicap <= 0` guard in `calcPlayerNetPerRound` |

After these fixes, existing `tournament_hole_results` rows with cumulative `player_points` will need to be recalculated. This happens automatically when any score is entered or overridden for an affected group (the engine re-runs and upserts all results).

