

# Plan: Tournament Engine Test Suite + Label Fix

## Issue Found
`calcMatchPlayIndividual` (line 217) always sets `label = 'Halved'` on tied holes, even when `halvedHoleRule = 'no_points'`. Best Ball correctly uses `hp > 0 ? 'Halved' : 'No points'`. Need to fix this inconsistency first so Test 3 passes as specified.

## Changes

### 1. Fix `src/services/tournamentEngine.ts` (line 217)
Change the tied-hole label in `calcMatchPlayIndividual` from:
```typescript
label = 'Halved';
```
to:
```typescript
label = hp > 0 ? 'Halved' : 'No points';
```
This matches the pattern used in Best Ball, Scramble, and Gross Best Ball.

### 2. Create `src/services/tournamentEngine.test.ts`
~700 lines. Factory helpers + 35 tests organized into 9 `describe` blocks:

**Helpers:**
- `makePlayer(id, name, hcap, override?)` → `TournamentPlayer`
- `makeGame(type, overrides?)` → `TournamentGame` with defaults: 1pt/hole, half_point, no handicaps, 100% allowance
- `makeHole(num, par, hdcpIdx)` → `CourseHole`
- `make18Holes()` → 18 par-4 holes with handicapIndex 1-18

**Test groups:**
1. **Match Play Individual** (Tests 1-6) — net comparisons, halved rules, handicap strokes, 18-hole totals, early close-out match state
2. **Best Ball 2v2** (Tests 7-11) — best ball, 2nd ball tiebreaker, halved variants
3. **Gross Best Ball** (Tests 12-15) — best 2/3/4 scoring by hole segment, halved
4. **Scramble** (Tests 16-18) — team score comparison, halved, 18-hole totals
5. **Tournament Sixes — Match Play** (Test 19) — delegates to Best Ball
6. **Tournament Sixes — Sum of Strokes** (Tests 20-23) — segment scoring with configurable points
7. **Handicap Calculations** (Tests 24-28) — `strokesReceived` edge cases, match play difference
8. **Max Score Per Hole** (Tests 29-30) — capping via `maxScorePerHole`
9. **Match State** (Tests 31-35) — in-progress, dormie, complete, all square, halved

After creating the file, tests will be run to verify all 35 pass.

