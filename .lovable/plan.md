

# Auto-Add Tournament Members When Players Are Added

## Problem
When the tournament admin adds players (with linked `user_id`s) to a tournament, those players are only inserted into `tournament_players` — not `tournament_members`. Since all tournament RLS policies use `is_tournament_member()`, these players cannot see any tournament data.

## Changes

### 1. `src/hooks/useTournaments.ts` — Tournament creation (line ~136)
After inserting players during tournament creation, also insert `tournament_members` rows for every player that has a `user_id`. Add after the players insert block:
```typescript
const memberInserts = input.players
  .filter(p => p.userId)
  .map(p => ({ tournament_id: tournamentId, user_id: p.userId! }));
if (memberInserts.length > 0) {
  await supabase.from('tournament_members').insert(memberInserts);
}
```

### 2. `src/hooks/useTournamentDetail.ts` — Adding individual player (line ~90)
After inserting a single player via `addPlayer`, also upsert a `tournament_members` row if the player has a `user_id`.

### 3. `src/hooks/useTournamentRoundSetup.ts` — Starting a round (line ~347)
After inserting `round_participants`, also upsert linked players into `tournament_members` to catch any edge cases.

### 4. Data fix — Backfill existing tournament
Run an INSERT to add all existing `tournament_players` with `user_id` values as `tournament_members` for the current tournament, so Clark and the others get immediate access.

### Unique constraint check
The `tournament_members` table needs a unique constraint on `(tournament_id, user_id)` to support safe upserts. Will verify and add via migration if missing.

