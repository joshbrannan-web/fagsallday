# Plan: Build "Hammer" Game

A new betting game with two variants: **Team Hammer** (2v2, segmented like 6's/3's) and **LR Hammer** (per-hole 2v2 or 2v1 team picks). Players "throw the hammer" mid-hole to double the pot. Built using patterns from 6's, Banker, and FBO press.

## Game Rules (confirmed)

**Variants**
- **Team Hammer**: 4 players, 2v2 fixed teams per segment. Segments: **3, 6, or 18 holes** (user picks at setup, like 6's vs 3's).
- **LR Hammer (Left/Right)**: 3 or 4 players. Teams chosen **per hole** (not per segment).
  - 4 players → 2v2 picked each hole
  - 3 players → 2v1 picked each hole; solo player wins/loses against each opponent

**Stake & multipliers**
- Base bet: $5 default, ±$1 increments (matches Banker pattern).
- Birdie multiplier: 1x / 2x / 3x (same UI as Banker).
- Eagle multiplier: 1x / 3x / 5x (same UI as Banker).
- Multipliers apply to the **final hammered pot**, only when **the winning team's low ball** is a gross birdie/eagle.

**Hammer mechanic (mid-round)**
- Hammer icon button on each hole. Each press doubles the current pot ($5 → $10 → $20 → $40 …).
- **Turn-based throwing**: After Team A throws, Team B must throw next before A can throw again. Track `lastThrownBy` per hole.
- "Accept" / "Throw it back" pattern: when one team throws, the other team gets a confirm-or-counter prompt (similar to FBO press dialog).

**Handicaps** — user picks in setup: None / Absolute / Relative (default Relative). Same logic as Banker/6's.

**Scoring & payouts**
- Compare net (or gross) **low ball** between teams.
- **Tied hole = push.** No money exchanged. Pot resets to base $5 next hole. Hammer state cleared.
- **Team Hammer (2v2)**: each loser pays the hammered pot, each winner receives it. (Example: $20 pot → 2 winners +$20 each, 2 losers -$20 each.)
- **LR Hammer 2v2**: same as Team Hammer for that hole.
- **LR Hammer 2v1**: solo wins → each of the 2 pays solo the pot (solo +2×pot). Pair wins → solo pays each of the 2 the pot (solo -2×pot).

## Files to Create

```text
src/services/hammerEngine.ts                     # pure calc: pot doubling, low-ball compare, multipliers, payouts
src/components/hammer/HammerTeamSetup.tsx        # Team Hammer segment setup (mode + team picker per stretch)
src/components/hammer/HammerHolePicker.tsx       # LR Hammer per-hole team picker (2v2 or 2v1)
src/components/hammer/HammerStatusBar.tsx        # current pot, last-thrown-by, hammer button
src/components/hammer/HammerThrowDialog.tsx      # AlertDialog: accept or throw it back
src/components/hammer/HammerStretchSummary.tsx   # per-segment recap (Team Hammer)
src/components/hammer/HammerRoundSummary.tsx    # full-round recap
src/components/hammer/index.ts
```

## Files to Edit

```text
src/types.ts                       # add GameType.HAMMER, HammerMode, HammerHoleState, HammerSegmentState, config block
src/lib/gameLibrary.ts             # add Hammer to GAME_LIBRARY + GAME_DETAILS
src/services/gameEngine.ts         # route HAMMER to hammerEngine.calculate
src/components/SetupWizard.tsx     # show Hammer setup screens (variant + mode + multipliers + handicaps)
src/components/ActiveRound.tsx     # render HammerStatusBar + per-hole picker (LR) + Hammer button
src/components/RoundSummary.tsx    # include Hammer in totals
src/components/scoreboards/*       # ensure points/results scoreboards count Hammer P&L
```

## Data Model

Stored in `gameData[hammerGameId][holeNumber]`:

```ts
{
  // Team Hammer (segment-based, 2v2)
  teamA?: string[];          // 2 player IDs
  teamB?: string[];          // 2 player IDs
  // LR Hammer (per-hole)
  lrTeam?: string[];         // 2 player IDs (4p mode = team A, other 2 = team B)
  lrSolo?: string;           // single player ID (3p mode 2v1)
  lrPair?: string[];         // 2 player IDs (3p mode 2v1)
  // Hammer state
  hammerCount: number;       // 0..N doublings
  lastThrownBy: 'A' | 'B' | null;
  // Result (computed)
  pot: number;               // base × 2^hammerCount × birdie/eagle multiplier (when settled)
  winningTeam: 'A' | 'B' | null;  // null = push
}
```

Segment metadata for Team Hammer stored at the stretch's first hole under a `_META_HAMMER_SEGMENT` key (mirrors 6's pattern).

Config:
```ts
hammer: {
  variant: 'team' | 'lr';
  segmentLength?: 3 | 6 | 18;       // Team Hammer only
  birdieMultiplier: 1 | 2 | 3;
  eagleMultiplier: 1 | 3 | 5;
}
useHandicaps: boolean;
handicapMode: 'absolute' | 'relative';
```

## UI Details

- **Hammer button**: red/yellow hammer icon (lucide `Hammer`), prominent on the hole tracker. Disabled when it's not your team's turn (`lastThrownBy === yourTeam`).
- **Pot indicator**: shows `$5 → $10 → $20` chips with each throw recorded.
- **Throw dialog** (AlertDialog, per project preference): "Team A threw the hammer. Pot is now $20. Accept or throw it back?" Two buttons: **Accept** (locks pot at $20, disables further throws this hole) / **Throw it back** (doubles to $40, turn passes back).
- **Per-hole team picker (LR mode)**: appears at top of each hole before scores; 4-player = pick 2 for Team A; 3-player = pick which 1 is solo.

## Constraints & Reuse

- Min/max players: Team Hammer = 4, LR Hammer = 3–4. Library entry uses min 3, max 4.
- Reuses: Banker's birdie/eagle multiplier picker, 6's segment-length picker & rotation UI, FBO press dialog pattern for the throw-back interaction, Stockton6 stretch summary layout.
- Tournament mode: **excluded** (per "Side Games Constraint" memory — Hammer's per-hole team flexibility doesn't fit tournament-fixed teams). Won't appear in TournamentBuildRoundWizard.
- Offline-first, atomic JSONB writes via `patch_round_game_data` RPC (no schema changes needed).
- Memory: add `mem://games/hammer-comprehensive.md` and reference in index.

## Out of Scope

- No new DB tables/migrations (uses existing `rounds.game_data` blob).
- No tournament integration in v1.
- No per-hole presses beyond the Hammer itself (the Hammer *is* the press).
