

# Fix Stale Closure in Realtime Subscription

## Problem
The realtime subscription `useEffect` depends on `groups`, causing it to tear down and rebuild on every groups state update. The `allGroupIds` variable is captured at subscription creation time — if Group 2's data arrives after the channel is built, its events are silently filtered out.

## Changes — `src/hooks/useTournamentScoreboards.ts`

### 1. Add a ref (after line 23)
```ts
const allGroupIdsRef = useRef<string[]>([]);
```

### 2. Add a sync effect (after line 261, before the realtime useEffect)
```ts
useEffect(() => {
  allGroupIdsRef.current = Object.values(groups).flat().map((g: any) => g.id);
}, [groups]);
```

### 3. Update the realtime subscription useEffect (lines 263-312)
- Remove the `const allGroupIds = ...` local variable (line 267)
- Remove the `if (allGroupIds.length === 0) return;` early exit (line 268)
- Replace all 4 occurrences of `allGroupIds` with `allGroupIdsRef.current`:
  - Line 275: `fetchScoresAndResults(allGroupIdsRef.current)`
  - Line 278: `allGroupIdsRef.current.includes(row.tournament_group_id)`
  - Line 290: `fetchScoresAndResults(allGroupIdsRef.current)`
  - Line 293: `allGroupIdsRef.current.includes(row.tournament_group_id)`
- Remove `groups` from the dependency array (line 312): `[tournamentId, fetchAll, fetchScoresAndResults]`

This ensures the channel is created once per `tournamentId` and always reads the latest group IDs via the ref.

