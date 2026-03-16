

# Fix: Ensure tournamentGroupId is Always in _TOURNAMENT_META at INSERT Time

## Problem
The round is INSERTed with a partial `_TOURNAMENT_META` (no `tournamentGroupId`), then a second UPDATE adds it. If the UPDATE fails, `useTournamentOverlay` gets `tournamentGroupId: undefined` on reload, breaking tournament scoring entirely.

## Changes

### 1. `src/hooks/useTournamentRoundSetup.ts` — Reorder operations in `startRound`

Restructure the `startRound` callback (lines 232-390) so the group is resolved **before** the round INSERT:

1. Build `players` array and `teamMatchup` (unchanged)
2. Build `pMapping` (move up from line 332)
3. Resolve `activeGroupId`:
   - If `selectedGroupId`: use it directly (don't update its `round_id` yet)
   - If no `selectedGroupId`: create the group with `round_id: null`, get its ID
4. INSERT the round with the **complete** `_TOURNAMENT_META` including `tournamentGroupId`, `playerMapping`, `teamMatchup` — single write, no follow-up UPDATE needed
5. After round INSERT succeeds, update the group's `round_id` to the new round ID
6. If no `selectedGroupId`, insert group players (unchanged)
7. Insert `round_participants` (unchanged)
8. Remove the second `rounds.update` call entirely (lines 337-350)

### 2. `src/components/ActiveRound.tsx` — Add diagnostic guard

After line 43 (`const tournamentGroupId = ...`), add:

```ts
if (meta?._TOURNAMENT_META && !tournamentGroupId) {
  console.warn('[Tournament] Missing tournamentGroupId in _TOURNAMENT_META — scores will not be tracked in tournament leaderboard');
}
```

Wait — looking at line 42-43, `meta` is already `_TOURNAMENT_META` (it reads `gameData?.['_TOURNAMENT_META']`), so the guard should check `if (meta && !tournamentGroupId)`.

## Summary

| File | Change |
|------|--------|
| `useTournamentRoundSetup.ts` | Reorder: resolve group → INSERT round with full meta → update group's round_id. Eliminates second UPDATE. |
| `ActiveRound.tsx` | Add console.warn when tournament meta exists but tournamentGroupId is missing (~3 lines) |

