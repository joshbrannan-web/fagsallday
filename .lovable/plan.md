## Add 2nd Ball Tiebreaker to Hammer

Mirror the existing 2nd ball tiebreaker pattern from Sixes / Team Banker so Hammer holes that tie on the team's low ball can be decided by the team's 2nd ball instead of always pushing.

### Files to change

**1. `src/types.ts`** — extend the `hammer` config:
```ts
hammer?: {
  variant: 'team' | 'lr';
  segmentLength?: 3 | 6 | 18;
  useSecondBallTiebreaker?: boolean; // NEW
};
```

**2. `src/lib/gameLibrary.ts`** — update Hammer default config to include `useSecondBallTiebreaker: false`.

**3. `src/components/GameSelector.tsx`** — in the Hammer config section (around the variant/segment-length block, lines 692–749), add a Switch row identical to the Team Banker one (line 674–687):
- Label: "2nd Ball Tiebreaker"
- Sub-label: "If 1st balls tie, compare 2nd balls"
- Bound to `selectedGame.config.hammer?.useSecondBallTiebreaker ?? false`
- Updates via `updateGameConfigDeep` preserving `variant` and `segmentLength`.

**4. `src/services/hammerEngine.ts`** — update `calculateHammerHole`:
- After computing `aLow` / `bLow`, if they tie AND `game.config.hammer?.useSecondBallTiebreaker === true` AND each team has ≥2 players (skip in 2v1 LR mode — solo has no 2nd ball), compare each team's 2nd-lowest net.
- If the 2nd balls break the tie, set `winningTeam` accordingly. The rest of the function (multipliers, payouts, low-ball detection for birdie/eagle) continues unchanged using the winning team's lowest-net ball owner.
- If still tied (or 2v1), fall through to the existing push behavior.

### Behavior

- **Off (default)**: tie on low ball → push, pot doubles on next hole as today.
- **On (2v2)**: tie on low ball → compare 2nd ball; lower 2nd ball wins the pot. Still tied → push.
- **2v1 LR holes**: option is ignored (solo has only 1 ball) — still pushes on tie.

### Out of scope

- No changes to Hammer throw/turn logic, segment teams, payouts math, or status-bar UI.
- No memory/doc updates needed beyond the existing Hammer memory note (can be appended after implementation).
