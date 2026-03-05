

# Plan: Persist Tournament State via `_TOURNAMENT_META` in `gameData`

## Problem
When a player navigates away from `/active` (e.g., to scorecard or home) and returns, `location.state` is lost. This means `tournamentGroupId`, `playerMapping`, and `teamMatchup` are all `undefined`, causing:
1. The betting/tournament tab toggle to disappear entirely
2. Tournament overlay not loading

`RoundSummary` already handles this by falling back to `currentRound.gameData._TOURNAMENT_META` — but `ActiveRound` does not.

## Fix

Two changes:

### 1. Store `playerMapping` and `teamMatchup` in `_TOURNAMENT_META` (src/hooks/useTournamentRoundSetup.ts)

The `_TOURNAMENT_META` already stores `tournamentGroupId`, `tournamentName`, and `roundName`, but not `playerMapping` or `teamMatchup`. Add them to the second `update` call (line 284-295) so they persist in the round's `gameData`.

### 2. Fall back to `_TOURNAMENT_META` in `ActiveRound.tsx` (lines 41-50)

Apply the same pattern `RoundSummary` uses: if `location.state` doesn't contain tournament data, read it from `currentRound?.gameData?._TOURNAMENT_META`.

```tsx
const tournamentState = (location.state as any) || {};
const meta = (currentRound?.gameData as any)?.['_TOURNAMENT_META'];
const tournamentGroupId = tournamentState.tournamentGroupId || meta?.tournamentGroupId;
const tournamentPlayerMapping = tournamentState.playerMapping || meta?.playerMapping;
const tournamentName = tournamentState.tournamentName || meta?.tournamentName;
const tournamentRoundName = tournamentState.tournamentRoundName || meta?.roundName;
const teamMatchup = tournamentState.teamMatchup || meta?.teamMatchup;
```

Then pass these derived values into `useTournamentOverlay` and for the `activeTab` default.

### 3. Pass tournament state when navigating back to `/active` (Scorecard.tsx, RoundSummary.tsx, Landing.tsx)

As a belt-and-suspenders measure, update the "Return to Hole" navigations in `Scorecard.tsx` (lines 903, 1311) and `RoundSummary.tsx` (line 597) to forward the current `location.state` so tournament data isn't dropped during in-session navigation.

| File | Change |
|---|---|
| `src/hooks/useTournamentRoundSetup.ts` | Add `playerMapping` and `teamMatchup` to `_TOURNAMENT_META` |
| `src/components/ActiveRound.tsx` | Fall back to `_TOURNAMENT_META` for all tournament values |
| `src/components/Scorecard.tsx` | Forward `location.state` when navigating to `/active` |
| `src/components/RoundSummary.tsx` | Forward `location.state` when navigating to `/active` |
| `src/components/Landing.tsx` | Read `_TOURNAMENT_META` from `currentRound` and pass as state when resuming |

5 files changed, 0 database changes.

