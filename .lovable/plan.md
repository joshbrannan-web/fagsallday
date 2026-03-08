

# Fix: Tournament Team Totals Should Only Count Completed Rounds

## Problem

The `RyderCupGraphic` component calls `calcTeamTotals(holeResults, teamIds)` on **all** hole results across every round — including in-progress ones. This means the grand total (the big "4.5 — 0.5" display) includes live scoring from active rounds. The user expects the tournament-wide total to only reflect **completed** rounds, since points aren't "official" until a round finishes.

## Intended Behavior

| Section | Data Source |
|---|---|
| **Grand total** (big numbers) | Only completed rounds |
| **Per-round breakdown rows** | All started rounds (active + completed), showing live scores |
| **Progress bar** | Only completed rounds (matches grand total) |

This way the per-round rows still show live scores as a preview, but the authoritative tournament total only counts finalized rounds.

## Changes

### `src/components/scoreboards/RyderCupGraphic.tsx`

Instead of `calcTeamTotals(holeResults, teamIds)` which sums everything, compute the grand total by summing only completed rounds from `perRound`:

```ts
// Replace line 22-23 area:
const perRound = calcTeamTotalsPerRound(rounds, groups, holeResults, teamIds);

// Grand total = only completed rounds
const completedRounds = rounds.filter((r: any) => r.status === 'completed');
const totals: Record<string, number> = {};
teamIds.forEach(id => { totals[id] = 0; });
completedRounds.forEach((r: any) => {
  const rTotals = perRound[r.id] || {};
  teamIds.forEach(id => { totals[id] += rTotals[id] || 0; });
});
```

Lines 25-27 (`totalA`, `totalB`, `grandTotal`) stay the same since they read from `totals`.

### `src/components/scoreboards/TeamPointsBreakdownTable.tsx`

No changes needed — the breakdown table already shows per-round and per-group detail which is fine to be live.

**1 file changed, 0 database changes.**

