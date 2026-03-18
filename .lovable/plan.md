

# Add "2 Man Score" Tournament Game Type

## Overview
A new 2v2 team format where both players' scores on each hole are **summed** (not best-ball). The team with the lower combined score wins the hole. Supports Gross or Net scoring with standard match play points.

## Files to Change

### 1. `src/types/tournament.ts`
- Add `'two_man_score'` to `TournamentGameType` union

### 2. `src/components/tournament-admin/RoundConfigCard.tsx`
- Add entry to `TOURNAMENT_GAME_DETAILS` with name "2 Man Score (2v2)" and description
- Add entry to `GAME_TYPES` array
- The existing handicap controls (`useHandicaps`, `handicapAllowancePercent`) already handle the Gross vs Net choice — when `useHandicaps` is off, it's Gross; when on, it's Net with the existing handicap mode (relative/allowance slider)

### 3. `src/components/tournament-admin/WizardStepReview.tsx`
- Add `two_man_score: '2 Man Score (2v2)'` to `GAME_LABELS`

### 4. `src/components/tournament/TournamentRoundCard.tsx`
- Add `two_man_score: '2 Man Score 2v2'` to `GAME_TYPE_LABELS` (exported, also used by TournamentBuildRoundWizard)

### 5. `src/services/tournamentEngine.ts`
- Add `calcTwoManScore(input: EngineInput): RoundResult` function
  - Logic: For each hole, sum all players' (net or gross) scores per team. Lower sum wins the hole's points. Halved-hole rule applies on ties. Max score capping applies.
  - Very similar to `calcMatchPlayBestBall` but uses **sum** instead of **min**
- Add `'two_man_score'` case to `calcTournamentHoleResults` dispatch

### 6. `src/components/tournament/TournamentHoleTracker.tsx`
- Update `getTeamScore` in the default 2v2 view: for `two_man_score` game type, show the **sum** of team player scores instead of `Math.min`. This requires passing `gameType` into the score display logic (the prop already exists).

### 7. `src/components/tournament-admin/RoundPairingsEditor.tsx`
- No change needed — `two_man_score` is a 2v2 format (not 1v1), so it doesn't go in `ONE_V_ONE_TYPES`

## Engine Function: `calcTwoManScore`

```text
For each hole:
  1. Get all players' gross scores (capped at max)
  2. Calculate net scores if handicaps enabled (using matchPlayStrokeDifference)
  3. Sum team A's scores, sum team B's scores
  4. Lower sum wins → gets hole points
  5. Equal sums → halved hole rule applies
```

This reuses all existing utilities (`matchPlayStrokeDifference`, `maxScoreForHole`, `holePointValue`, `halvedPoints`, `calcMatchState`).

## No Database Migration Needed
The `tournament_games.game_type` column is `text` (not an enum), so `'two_man_score'` works without schema changes.

