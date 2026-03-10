

# Fix Handicap Data for Betting Games in Tournament Mode

## Problem
When a tournament round is started, players are created with `courseHandicap: 0` hardcoded. The normal SetupWizard properly calculates this using `calculateCourseHandicap(handicapIndex, 72)`. Since all betting game engines (Banker, Skins, Nassau, etc.) use `player.courseHandicap` for stroke calculations, tournament-mode betting games have no handicap info.

## Changes

### 1. `src/hooks/useTournamentRoundSetup.ts` (line 241)
Import `calculateCourseHandicap` from `gameEngine` and use it when building the players array in `startRound`:

```typescript
courseHandicap: calculateCourseHandicap(tp.handicap_override ?? tp.handicap_index, 72),
```

### 2. `src/components/tournament/TournamentBuildRoundWizard.tsx` (line 289)
Same fix for the player mapping passed to GameSelector in step 6:

```typescript
courseHandicap: calculateCourseHandicap(p.handicap_index ?? 0, 72),
```

**2 files, 2 lines changed + 2 import additions.**

