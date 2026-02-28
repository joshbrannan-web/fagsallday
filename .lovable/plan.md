

## Plan: Show Team Banker per-hole P&L on Scorecard

The Scorecard's P&L row (the money line under each player's scores) is driven by `calculateAggregatedHolePnL` in `src/services/gameEngine.ts`. This function aggregates per-hole results from Banker, Skins, Nassau, Wolf, etc. — but **Team Banker is missing** from it. The `calculateTeamBanker` engine already produces `holeResults` with per-hole breakdowns, so this is a one-block addition.

### Change

**File: `src/services/gameEngine.ts`** — Add Team Banker processing block inside `calculateAggregatedHolePnL` (after the existing Nine Points block, around line 1870):

```typescript
// Process Team Banker games
round.games
  .filter((g) => g.type === GameType.TEAM_BANKER)
  .forEach((game) => {
    const result = calculateTeamBanker(round, game);
    if (result.holeResults?.[holeNumber]) {
      Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
        holePnL[holeNumber][playerId] += amount;
      });
    }
  });
```

This follows the exact same pattern used for Skins, Wolf, Nine Points, and Stockton 6's. No other files need changes — the Scorecard already reads from `calculateAggregatedHolePnL` for the P&L row, and the `GameRoundTotals` component for Team Banker is already rendered.

