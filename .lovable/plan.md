

# Fix #42: Store Tournament Metadata in Round `game_data`

## Problem
When `startRound()` creates a round, it stores metadata under `_tournament_meta` (lowercase) but with incomplete fields. The round history has no way to identify tournament rounds or display a tournament-specific label.

## Changes

### 1. `src/hooks/useTournamentRoundSetup.ts` — Enrich metadata key

Change the key from `_tournament_meta` to `_TOURNAMENT_META` (uppercase, consistent with other meta keys like `_META_PRESSES`, `_META_TEAM_A`) and add the missing fields.

**Initial insert (line 226-231)** — replace with:
```js
game_data: {
  _TOURNAMENT_META: {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    roundNumber: selectedRound.round_number,
    roundName: selectedRound.name || `Round ${selectedRound.round_number}`,
    displayName: `${tournament.name} — Round ${selectedRound.round_number}`,
  },
}
```

**Post-group update (lines 279-287)** — same structure plus `tournamentGroupId: newGroup.id`.

### 2. `src/components/RoundHistory.tsx` — Show tournament label + trophy

In the `RoundCard` component, extract tournament meta from `round.gameData?._TOURNAMENT_META`. If it exists:

- Replace the round title (`round.course.name`) with `meta.displayName` as the primary heading
- Show course name as a secondary line below it (smaller text)
- Add a 🏆 `Trophy` icon badge (already imported in the file) next to the title, styled like the existing LIVE/LOCKED/SHARED badges

Also update the search filter (line 191-195) to include `_TOURNAMENT_META.displayName` so tournament rounds are searchable by tournament name.

### Files
- **Modify:** `src/hooks/useTournamentRoundSetup.ts` (2 spots: initial insert + post-group update)
- **Modify:** `src/components/RoundHistory.tsx` (RoundCard title rendering + search filter)

No new tables, columns, or migrations required.

