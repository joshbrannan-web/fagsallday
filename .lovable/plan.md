

# Fix: Alternate Shot Reading Wrong Player's Score

## Problem
`calcAlternateShot` delegates to `calcScramble`, which always reads the score from `teamPlayers[tid][0]` (line 542). In Alternate Shot, players alternate who plays each hole — so on odd holes the score should come from player index 1, not player index 0. This produces wrong results for every other hole.

## Fix
Replace the `calcScramble` delegation (lines 637-641) with a self-contained scoring loop inside `calcAlternateShot`. The new logic:

1. Keep the existing team handicap calculation and `teamDiffs` (lines 610-622) — this is correct.
2. Replace lines 624-641 with a full scoring loop (similar to `calcScramble` but with alternating player selection):

```typescript
for (const hole of courseHoles) {
  const max = maxScoreForHole(game, hole.par);

  const getTeamScore = (tid: string): number | null => {
    const tp = teamPlayers[tid] || [];
    // Alternate: even holes (1,3,5...) = player[0], odd holes (2,4,6...) = player[1]
    const playerIndex = (hole.number - 1) % tp.length;
    const shooter = tp[playerIndex];
    if (!shooter) return null;
    const g = input.scores[shooter.id]?.[hole.number];
    if (g === undefined) return null;
    const adj = Math.min(g, max);
    return netScore(adj, strokesReceived(teamDiffs[tid], hole.handicapIndex));
  };

  // ... same point assignment logic as calcScramble (aScore vs bScore comparison)
}
```

3. Build `holeResults`, `teamTotals`, `playerTotals`, and return with `calcMatchState` — identical structure to `calcScramble`.

## File Changed
**`src/services/tournamentEngine.ts`** — rewrite `calcAlternateShot` (lines 605-641) as a standalone function instead of delegating to `calcScramble`. ~60 lines replacing ~37 lines. The `grossScores` recorded for each hole will show the actual shooter's score.

