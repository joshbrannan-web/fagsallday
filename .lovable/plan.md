
## Plan: Add 6's or 3's Mode Toggle

### Overview
Rename the "6's" game to "6's or 3's" and add a toggle to switch between two modes:
- **6's Mode**: 3 stretches of 6 holes each (current behavior)
- **3's Mode**: 6 stretches of 3 holes each (new behavior)

Both modes use identical match play logic - the only difference is the stretch length and count.

---

### Key Differences Between Modes

| Aspect | 6's Mode | 3's Mode |
|--------|----------|----------|
| Stretches | 3 | 6 |
| Holes per stretch | 6 | 3 |
| Stretch start holes | 1, 7, 13 | 1, 4, 7, 10, 13, 16 |
| Team rotations | 3 (every 6 holes) | 6 (every 3 holes) |

---

### Files to Modify

#### 1. Types (`src/types.ts`)

Add new config field for the mode selection:

```typescript
// Inside GameSettings.config.sixes
sixes?: {
  useSecondBallTiebreaker: boolean;
  allowPresses?: boolean;
  mode?: 'sixes' | 'threes';  // NEW: defaults to 'sixes'
}
```

Also update `SixesPressState.stretch` type from `1 | 2 | 3` to `1 | 2 | 3 | 4 | 5 | 6` to support 3's mode.

#### 2. Game Engine (`src/services/sixesEngine.ts`)

Update stretch definitions and helper functions:

```typescript
// Add 3's stretch definition
export const THREES_STRETCH_HOLES = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
  5: [13, 14, 15],
  6: [16, 17, 18],
};

// Update helper functions to accept mode parameter
export const getSixesStretchForHole = (
  hole: number, 
  mode: 'sixes' | 'threes' = 'sixes'
): 1 | 2 | 3 | 4 | 5 | 6 => {
  if (mode === 'threes') {
    if (hole <= 3) return 1;
    if (hole <= 6) return 2;
    if (hole <= 9) return 3;
    if (hole <= 12) return 4;
    if (hole <= 15) return 5;
    return 6;
  }
  // 6's mode (original)
  if (hole <= 6) return 1;
  if (hole <= 12) return 2;
  return 3;
};

export const isSixesStretchStartHole = (
  hole: number, 
  mode: 'sixes' | 'threes' = 'sixes'
): boolean => {
  if (mode === 'threes') {
    return [1, 4, 7, 10, 13, 16].includes(hole);
  }
  return [1, 7, 13].includes(hole);
};

export const isSixesStretchEndHole = (
  hole: number, 
  mode: 'sixes' | 'threes' = 'sixes'
): boolean => {
  if (mode === 'threes') {
    return [3, 6, 9, 12, 15, 18].includes(hole);
  }
  return [6, 12, 18].includes(hole);
};
```

Update all calculation functions to use the mode parameter and calculate stretch length dynamically (6 or 3 holes).

#### 3. Game Library (`src/components/SetupWizard.tsx`)

Update the game name and description:

```typescript
{
  type: GameType.SIXES,
  name: "6's or 3's",
  description: "2v2 match play: lowest ball wins each hole. Most holes won per stretch takes the bet.",
  icon: "🎲",
  defaultUnitStake: 10,
  minPlayers: 4,
  maxPlayers: 4,
  config: { 
    useHandicaps: true, 
    handicapMode: 'absolute', 
    sixes: { 
      useSecondBallTiebreaker: false,
      mode: 'sixes'  // Default to 6's mode
    } 
  },
}
```

#### 4. Team Setup Step (`src/components/TeamSetupStep.tsx`)

Add mode toggle to the setup UI:

- Add state: `const [sixesMode, setSixesMode] = useState<'sixes' | 'threes'>('sixes');`
- Add toggle group UI with "6's" and "3's" options
- Pass mode to metadata when saving

```tsx
<div className="flex items-center justify-between px-3 py-2 bg-muted rounded-xl">
  <div>
    <Label className="text-sm font-medium">Game Mode</Label>
    <p className="text-xs text-muted-foreground">
      {sixesMode === 'sixes' ? '3 stretches of 6 holes' : '6 stretches of 3 holes'}
    </p>
  </div>
  <ToggleGroup type="single" value={sixesMode} onValueChange={(v) => v && setSixesMode(v as 'sixes' | 'threes')}>
    <ToggleGroupItem value="sixes">6's</ToggleGroupItem>
    <ToggleGroupItem value="threes">3's</ToggleGroupItem>
  </ToggleGroup>
</div>
```

Save mode to metadata: `_META_MODE: sixesMode`

#### 5. Mid-Round Team Setup (`src/components/sixes/SixesTeamSetup.tsx`)

- Accept `mode` prop
- Update stretch hole display based on mode
- Update stretch type to support `1 | 2 | 3 | 4 | 5 | 6`
- Update team rotation logic for 6 stretches

```typescript
interface SixesTeamSetupProps {
  players: Player[];
  stretch: 1 | 2 | 3 | 4 | 5 | 6;  // Updated
  mode: 'sixes' | 'threes';  // NEW
  // ... rest of props
}

// Dynamic stretch holes display
const getStretchHoles = (stretch: number, mode: 'sixes' | 'threes') => {
  if (mode === 'threes') {
    const starts = [1, 4, 7, 10, 13, 16];
    const start = starts[stretch - 1];
    return `${start}-${start + 2}`;
  }
  return stretch === 1 ? '1-6' : stretch === 2 ? '7-12' : '13-18';
};
```

#### 6. Status Bar (`src/components/sixes/SixesStatusBar.tsx`)

- Read mode from metadata
- Update display title to show "6's" or "3's"
- Update hole ranges dynamically

```tsx
const mode = teamAssignment.mode || 'sixes';
const holesPerStretch = mode === 'threes' ? 3 : 6;

// Dynamic display
<span className="text-sm font-bold text-foreground">
  {mode === 'threes' ? "3's" : "6's"}: Holes {getStretchHoleRange(stretch, mode)}
</span>
```

#### 7. Match Summary (`src/components/sixes/SixesMatchSummary.tsx`)

- Update to iterate over 6 stretches when in 3's mode
- Update header to show "6's or 3's Match Play Results" with mode indicator
- Update hole range calculations

```tsx
const mode = stretchData[0]?.assignment?.mode || 'sixes';
const stretches = mode === 'threes' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];

// Header
<h3 className="font-bold text-foreground">
  {mode === 'threes' ? "3's" : "6's"} Match Play Results
</h3>
```

#### 8. Active Round (`src/components/ActiveRound.tsx`)

- Read mode from game config or Stretch 1 metadata
- Pass mode to all sixes-related components and engine functions
- Update stretch detection logic for 3's mode

```tsx
const sixesMode = sixesGame?.config?.sixes?.mode || 
  getSixesTeamAssignment(currentRound.gameData, sixesGame.id, 1)?.mode || 
  'sixes';
```

#### 9. Scorecard (`src/components/Scorecard.tsx`)

- Pass mode to SixesMatchSummary and related calculations

#### 10. Round Summary (`src/components/RoundSummary.tsx`)

- Display mode in game config details

```tsx
// Inside getGameConfigDetails for SIXES
const mode = sixesData._META_MODE ?? 'sixes';
details.push(`Mode: ${mode === 'threes' ? "3's" : "6's"}`);
```

---

### Metadata Changes

Add to Stretch 1 (hole 1 for 6's, or hole 1 for 3's) metadata:

```typescript
{
  _META_MODE: 'sixes' | 'threes',  // NEW
  _META_TEAM_A: string[],
  _META_TEAM_B: string[],
  _META_UNIT_VALUE: number,
  _META_USE_HANDICAPS: boolean,
  _META_USE_SECOND_BALL: boolean,
  _META_ALLOW_PRESSES: boolean,
  _META_HANDICAP_MODE: 'absolute' | 'relative',
  _META_LOCKED: boolean,
}
```

---

### Engine Calculation Changes

The core calculation logic remains the same - just parameterized:

1. **`calculateSixesStretchResult`**: Use dynamic holes per stretch (3 or 6)
2. **`calculateSixesStretchPayouts`**: Use dynamic stretch end hole
3. **`calculateSixes`**: Iterate over 3 or 6 stretches based on mode
4. **`getSixesDormieStatus`**: Use dynamic holes remaining (3 or 6 minus played)

---

### Team Rotation Logic

For 3's mode with 6 stretches, the rotation ensures no duplicate pairings:

Given players A, B, C, D:
- Stretch 1: AB vs CD
- Stretch 2: AC vs BD  
- Stretch 3: AD vs BC
- Stretches 4-6: Repeat pattern (since only 3 unique pairings exist for 4 players)

The existing `getRotatedTeams` function already handles this by tracking previous pairings.

---

### Summary of Files

| File | Changes |
|------|---------|
| `src/types.ts` | Add `mode` to sixes config, expand stretch type |
| `src/services/sixesEngine.ts` | Add mode parameter to all functions, add THREES_STRETCH_HOLES |
| `src/components/SetupWizard.tsx` | Rename game, add default mode |
| `src/components/TeamSetupStep.tsx` | Add mode toggle UI |
| `src/components/sixes/SixesTeamSetup.tsx` | Support 6 stretches, show mode |
| `src/components/sixes/SixesStatusBar.tsx` | Dynamic mode display |
| `src/components/sixes/SixesMatchSummary.tsx` | Support 6 stretches |
| `src/components/sixes/SixesStretchSummary.tsx` | Dynamic stretch names |
| `src/components/ActiveRound.tsx` | Pass mode to components |
| `src/components/Scorecard.tsx` | Pass mode to calculations |
| `src/components/RoundSummary.tsx` | Display mode in config |

