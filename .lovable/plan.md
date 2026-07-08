## Goal

Let users pick a starting hole (1, 10, or any 1–18) when setting up a round. The round still plays a full 18 holes, wrapping around, and every game treats the chosen start hole as "play position 1" so segments (Front/Back), stretches (6's, Stockton 6), Hammer segments, Wolf rotation, and fixed-hole triggers (Bloody Banker "last 3 holes") all shift with the start.

## Core concept: play order vs. physical hole

Introduce a single helper that converts a physical hole number (1–18, what's on the scorecard) into a **play-order position** (1–18, where in the round it falls):

```text
playOrder(hole, startHole) = ((hole - startHole + 18) % 18) + 1
holeByOrder(order, startHole) = ((startHole - 1 + order - 1) % 18) + 1
```

Example, startHole = 10:
- Play positions 1–9  → physical holes 10, 11, 12, 13, 14, 15, 16, 17, 18 (= Front 9 for games)
- Play positions 10–18 → physical holes 1, 2, 3, 4, 5, 6, 7, 8, 9 (= Back 9 for games)
- Bloody Banker "last 3" trigger → physical holes 7, 8, 9
- Wolf hole-1 honor → the player up on physical hole 10

Every game engine rule that today compares against a fixed physical hole number gets rewritten to compare against the play-order position derived from `round.startHole`.

## Plan

### 1. Data model
- `src/types.ts` — add `startHole: number` (1–18, default 1) to `Round`.
- `src/services/offlineStorage.ts` and any round-creation paths — persist `startHole` in the cached round blob and DB `rounds.round_data` JSONB (no schema migration needed, it lives inside the existing JSON blob).

### 2. Shared helpers
- New `src/lib/holeOrder.ts` exporting:
  - `getPlayOrder(hole, startHole)`
  - `getHoleByPlayOrder(order, startHole)`
  - `getPlayedHoles(startHole)` → ordered array of 18 physical hole numbers
  - `getFrontNineHoles(startHole)` / `getBackNineHoles(startHole)` → arrays of physical holes for the first-played 9 and second-played 9
  - `isInLastNPlayed(hole, startHole, n)` for Bloody Banker's "final 3"

### 3. Setup wizard UI
- `src/components/SetupWizard.tsx` — add a "Starting Hole" control in the round-basics step:
  - Segmented buttons: **Hole 1**, **Hole 10**, **Other…**
  - "Other…" reveals a number input / select (1–18)
  - Default: 1 (existing behavior preserved for anyone who doesn't touch it)
  - Store on the round object being built.
- Mirror the same control in `src/components/tournament/TournamentBuildRoundWizard.tsx` for tournament rounds.

### 4. Game engine updates (segment/stretch/trigger logic)
Everywhere a hole number is compared to 9, 10, 16, 17, or 18, replace with the play-order equivalent using `round.startHole`:

- `src/services/gameEngine.ts`
  - Nassau / FBO Front/Back/Overall segmentation (`currentHole <= 9`, `segmentStart = 1|10`, `segmentEnd = 9|18`) → derive from play order.
  - Skins carryover iteration order → iterate in play order.
  - Nine Points, Bingo Bango Bongo, Stroke, Match, etc. — none of these are hole-position sensitive; verify no changes needed.
- `src/services/sixesEngine.ts` — 6's = 3 stretches of 6 played holes; 3's = 6 stretches of 3 played holes. Compute stretch by play-order position, not physical hole.
- `src/services/stockton6Engine.ts` — same stretch remap.
- `src/services/hammerEngine.ts` — `getHammerSegmentStartHole` returns a *physical* hole; refactor to accept `startHole` and return the physical hole at play-order position (1, segLen+1, 2·segLen+1, …).
- `src/services/teamBankerEngine.ts` — sixes/threes rotation keyed to play order.
- Bloody Banker "Down the Most" activation (currently physical holes 16–18) → last 3 played holes.
- Wolf rotation order in `ActiveRound.tsx` → rotate by play order starting at start hole.

### 5. Active round & scorecard UI
- `src/components/ActiveRound.tsx`
  - Default `activeHole` on entry = `round.startHole` (fallback to existing `location.state.startHole`).
  - "Next hole" / "Previous hole" navigation follows play order (wrap 18→1).
  - Bloody Banker activation prompt fires at play-order position 16 (not physical hole 16).
  - Wolf/Banker/Team-Banker rotations use play order.
  - "First incomplete hole" scans in play order.
- `src/components/Scorecard.tsx`, `src/components/tournament/TournamentScorecardTable.tsx`, `src/components/tournament/TournamentFullScorecard.tsx`, `src/components/AdminScorecard.tsx`, `src/pages/ViewRound.tsx`
  - Keep physical hole numbers as column headers (that's what's on the real scorecard), but group the "Front 9" / "Back 9" tables by play-order (first 9 played = Front table).
  - Show a small "Started on hole N" indicator when `startHole !== 1`.
- `src/components/RoundSummary.tsx` / `AdminRoundSummary.tsx` / `Stockton6StretchSummary.tsx` / `SixesStretchSummary.tsx` — stretch/segment labels reflect the shifted holes.

### 6. Backward compatibility
- Rounds without `startHole` in stored JSON → treat as `1`. All existing rounds continue to behave exactly as before.
- All helpers are pure and default to `startHole = 1`, so untouched call sites are safe during the incremental refactor.

### 7. Tests
- Extend `src/services/tournamentEngine.test.ts` (or add `holeOrder.test.ts`) with cases for startHole = 1, 10, 7.
- Add engine tests: Sixes stretch boundaries with startHole=10; FBO Front/Back with startHole=7; Bloody Banker last-3 trigger with startHole=5; Hammer 6-hole segments with startHole=10.

## Out of scope
- No DB schema migration (uses existing `round_data` JSONB).
- No changes to Skins/Nine Points/Bingo Bango/Stroke scoring math beyond iteration order.
- Tournament shotgun starts across multiple groups with different start holes — this plan supports it per-round-per-group only if the tournament round wizard exposes the field per group; wider shotgun UI is a follow-up if you want it.

## Open follow-up (confirm after implementation)
Do you want the tournament admin to also set a per-group starting hole (true shotgun start), or is round-level start hole enough for now?
