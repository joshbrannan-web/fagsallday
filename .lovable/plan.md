

# Add "Teams" Mode to FBO (Front/Back/Overall)

## What changes

Add a new game mode option to FBO alongside the existing **All Together** and **Head to Head** modes: **Teams (2v2)**. All FBO rules stay the same (dots per hole, Front/Back/Overall segments, presses) — but dots are awarded to a team rather than an individual, and payouts settle team-vs-team like the existing Sixes flow.

Players choose Teams mode during game setup, assign 2 players to Team A and 2 to Team B, and toggle whether the **2nd ball is used as a tiebreaker** when the 1st (low) balls tie on a hole.

## Setup UI (GameSelector.tsx)

In the FBO settings panel, add a third radio option to the existing Game Mode group:

- **All Together** (existing)
- **Head to Head** (existing)
- **Teams (2v2)** ← new

When **Teams** is selected, render under the radio group:
1. **Team A / Team B assignment** — two columns of toggleable player chips. Exactly 2 players per team required. Reuses the same UI pattern as `SixesTeamSetup`.
2. **Use 2nd Ball as Tiebreaker** — Switch toggle. When ON, if the two teams' low balls tie on a hole, the 2nd-lowest ball from each team is compared. Default OFF.
3. **Allow Presses** — already exists, kept as-is (now applies team-vs-team).

Player count for Teams mode is locked at exactly 4 (the universal "Players in FBO" chip section continues to govern who's eligible; in Teams mode it must be exactly 4 selected).

## Data model (src/types.ts)

Extend `GameSettings.config.fbo`:
```ts
fbo?: {
  allowPresses: boolean;
  handicapMode?: 'absolute' | 'relative';
  gameMode?: 'together' | 'headToHead' | 'teams';   // add 'teams'
  headToHeadMatchups?: [...];
  teams?: {                                          // new
    teamA: string[];                                 // 2 player IDs
    teamB: string[];                                 // 2 player IDs
    useSecondBallTiebreaker: boolean;
  };
}
```

## Per-hole dot logic (ActiveRound.tsx)

Add a third branch in the FBO dot-awarding effect that runs after every score change:

- For each hole where all 4 players have a score, compute each team's **low net ball**.
- Lower team net = team wins the dot for that hole. The hole's dot is recorded under `gameData[gameId][hole].teamDot = 'A' | 'B'`.
- If team low balls tie:
  - If `useSecondBallTiebreaker` is OFF → no dot (push hole).
  - If ON → compare 2nd-lowest net ball; lower wins the dot. Still tied → push.

## Settlement (gameEngine.ts → calculateFBO)

Add a `gameMode === 'teams'` branch parallel to the existing H2H branch:

- Count `teamDot` entries per segment (Front 1–9, Back 10–18, Overall 1–18).
- Whichever team has more dots wins that segment. Each player on the winning team gets `+unitStake`, each player on the losing team `−unitStake`. Equal dots = push.
- Press handling (`_META_PRESSES`) reuses the existing FBO press array but settles team-vs-team using the same dot counts from the press's start hole forward. All existing press eligibility logic (dormie detection, double press) is reused with the team dot counts substituted for individual dot counts.

## Press eligibility helpers (gameEngine.ts)

Add team-mode variants (or branch inside the existing helpers) of:
- `getFBODormieStatus` / `getFBOOverallDormieStatus`
- `getFBOPressEligibility` / `getFBOPressEligibilityOverall`

These count `teamDot` instead of per-player dots and return dormie status from each team's perspective. Status bar / press buttons in `ActiveRound.tsx` route to the team variants when `gameMode === 'teams'`.

## Files changed

- **`src/types.ts`** — extend `fbo` config with `gameMode: 'teams'` and `teams` object
- **`src/components/GameSelector.tsx`** — add Teams radio option, team assignment UI, 2nd-ball-tiebreaker switch
- **`src/services/gameEngine.ts`** — add `teams` branch to `calculateFBO`, team-dot helpers, team-aware dormie/press helpers
- **`src/components/ActiveRound.tsx`** — branch the FBO scoring effect to award team dots when in Teams mode; route status bar / press UI to team-aware helpers
- **`src/lib/gameLibrary.ts`** — no functional change; FBO already allows 4 players within its 2–8 range

## Notes

- Existing FBO rounds (no `gameMode` or `gameMode: 'together' | 'headToHead'`) are unaffected — Teams is purely additive.
- Handicap mode (absolute/relative) and "Allow Presses" continue to work identically.
- Tournament Mode: FBO already isn't in the restricted list — Teams mode follows the same rules.

