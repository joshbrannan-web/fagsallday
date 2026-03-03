

# Piece 4: Tournament Scoring Engine

## Overview
Create the scoring engine for all 9 tournament game types and wire it into both the player score entry flow and admin score override flow. Also add two new columns to `tournament_games` for Tournament Sixes configuration.

## Database Migration
Add two columns to `tournament_games`:
```sql
ALTER TABLE tournament_games
  ADD COLUMN IF NOT EXISTS sixes_format TEXT DEFAULT 'match_play',
  ADD COLUMN IF NOT EXISTS sixes_segment_points JSONB DEFAULT '[1,1,1]';
```

## Files

### 1. Create `src/services/tournamentEngine.ts`
The complete scoring engine (~500 lines). Contains:

**Utility functions:**
- `getEffectiveHandicap` — returns `handicapOverride ?? handicapIndex`
- `calcCourseHandicap` — `Math.round(handicapIndex)`
- `strokesReceived` — per-hole stroke allocation (same logic as existing gameEngine)
- `matchPlayStrokeDifference` — relative handicap strokes for match play
- `netScore`, `holePointValue`, `halvedPoints` — simple helpers

**Output types:**
- `HoleResult` — per-hole breakdown (teamPoints, playerPoints, grossScores, netScores, resultLabel)
- `RoundResult` — full round output (holeResults[], teamTotals, playerTotals, matchState)
- `EngineInput` — standardized input shape (game config, players, scores, courseHoles)

**Game engine functions (one per format):**
- `calcMatchPlayIndividual` — 1v1, net score comparison per hole
- `calcMatchPlayBestBall` — 2v2, best net per team, optional 2nd ball tiebreaker
- `calcGrossBestBall` / `calcBlindGrossBestBall` — 4-man 6/6/6 format (best 2→3→4 scores per segment)
- `calcScramble` — shared team score, 25% combined handicap rule
- `calcAlternateShot` — shared team score, 50% combined handicap rule
- `calcTournamentSixes` — delegates to match_play or sum_of_strokes mode

**Match state calculator:**
- `calcMatchState` — computes leadingTeamId, leadAmount, isDormie, isComplete, resultLabel from accumulated hole results

**Main dispatcher:**
- `calcTournamentHoleResults(input)` — switches on `game.gameType` and calls the correct engine function

### 2. Modify `src/types/tournament.ts`
Add to `TournamentGame` interface:
```typescript
sixesFormat?: 'match_play' | 'sum_of_strokes';
sixesSegmentPoints?: [number, number, number];
```

### 3. Modify `src/hooks/useTournamentOverlay.ts`
Replace the `// TODO (Piece 4)` stub in `syncScore`. After writing to `tournament_hole_scores`:
1. Fetch all current scores for the group from local state + the new score
2. Fetch game config, hole point overrides, players, team assignments, course holes (loaded on mount)
3. Call `calcTournamentHoleResults(engineInput)`
4. Upsert all computed `HoleResult`s into `tournament_hole_results`
5. Update local overlay state with new match state for live UI

This requires the hook to also load `tournament_games`, `tournament_hole_points`, `tournament_players`, and `tournament_group_players` on mount (alongside teams and existing results). These are needed as engine input.

### 4. Modify `src/hooks/useTournamentScorecard.ts`
After `overrideScore` writes to `tournament_hole_scores`, run the same engine recalculation:
1. Build scores map from current state + override
2. Fetch game/players/course data (loaded on mount or passed as props)
3. Call `calcTournamentHoleResults`
4. Upsert results to `tournament_hole_results`

The admin scorecard hook needs to load the same supplementary data (game config, players, course holes) that the overlay hook loads.

### 5. Modify `src/components/tournament-admin/RoundConfigCard.tsx`
When `gameType === 'tournament_sixes'`, add:
- **Format selector** — "Match Play (per hole)" vs "Sum of Strokes (per segment)" using a Select dropdown
- **Segment point inputs** — 3 number inputs for holes 1-6, 7-12, 13-18 (shown only for sum_of_strokes mode)

Add `sixesFormat` and `sixesSegmentPoints` to `RoundConfigData` interface and `defaultRoundConfig`.

### 6. Modify `src/components/tournament-admin/RoundConfigCard.tsx` data interface
Add to `RoundConfigData`:
```typescript
sixesFormat: 'match_play' | 'sum_of_strokes';
sixesSegmentPoints: [number, number, number];
```

## Data Flow Summary
```text
Player enters score → ActiveRound.tsx
  → tournamentOverlay.syncScore(hole, playerId, gross)
    → upsert tournament_hole_scores
    → build EngineInput from loaded game data + all scores
    → calcTournamentHoleResults(input)
    → upsert tournament_hole_results (all holes)
    → update local overlay state (matchState, holeResults)
    → Realtime pushes to other viewers
```

## Note on the spec's `calcMatchState` typo
The spec has `teamATTotal` (double T) — will fix to `teamATotal` in implementation.

