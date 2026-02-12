

## Fix Team Rotation for 3's Mode (6 Stretches)

### Problem
With 4 players, there are only 3 unique team pairings possible. In 6's mode (3 stretches) and Stockton 6's (3 stretches), the rotation works correctly because there are exactly 3 stretches matching the 3 unique pairings.

In 3's mode (6 stretches), the rotation exhausts all unique pairings after stretch 3. For stretches 4-6, the current fallback always returns the same default pairing (players 1+2 vs 3+4) instead of cycling back through the original sequence.

### Solution
Update the `getRotatedTeams` function in all three team setup components to handle the cycling case:

- When `previousStretchTeams.length >= 3` (all unique pairings exhausted), use modular indexing to repeat the sequence: stretch 4 reuses stretch 1's teams, stretch 5 reuses stretch 2's, stretch 6 reuses stretch 3's.

### Files to change

1. **`src/components/sixes/SixesTeamSetup.tsx`** -- Update the `useEffect` auto-assign logic: when `previousStretchTeams.length >= 3`, set teams from `previousStretchTeams[(stretch - 1) % 3]` instead of calling `getRotatedTeams` (which would hit the fallback).

2. **`src/components/teamBanker/TeamBankerTeamSetup.tsx`** -- Same change: when previous teams count >= 3, cycle using modular index.

3. **`src/components/stockton6/Stockton6TeamSetup.tsx`** -- Stockton 6's only has 3 stretches so this isn't strictly needed, but for consistency, the same guard can be added.

### Technical Detail

In each setup component's `useEffect`, the auto-assign block will change from:

```text
if (stretch === 1 || previousStretchTeams.length === 0) {
  // default first pairing
} else {
  const rotated = getRotatedTeams(playerIds, previousStretchTeams);
  // ...
}
```

to:

```text
if (stretch === 1 || previousStretchTeams.length === 0) {
  // default first pairing
} else if (previousStretchTeams.length >= 3) {
  // All 3 unique pairings used -- cycle back through the sequence
  const cycleIndex = (stretch - 1) % 3;
  const source = previousStretchTeams[cycleIndex];
  setTeamA([...source.teamA]);
  setTeamB([...source.teamB]);
} else {
  const rotated = getRotatedTeams(playerIds, previousStretchTeams);
  // ...
}
```

This ensures stretches 4, 5, 6 mirror stretches 1, 2, 3 respectively.
