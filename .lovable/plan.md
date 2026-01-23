

## Plan: Enhanced 6's Match Play Summary on Scorecard

### Overview
Create a comprehensive 6's match play summary section on the Scorecard that displays all three 6-hole stretches with team assignments, match results, press information, and financial outcomes in a clear, visual format.

---

### Current Limitations

The current 6's Match Play section on the Scorecard:
- Only shows one stretch at a time (Front 9 or Back 9 view)
- The "Match" column only displays the result for the visible stretch
- Press information shows which team pressed but not financial outcomes
- No consolidated view of all three stretches together
- No total money won/lost summary

---

### Proposed Design

A new dedicated "6's Match Play Results" section that shows:

```text
+------------------------------------------------------------------+
|  6's Match Play Results                        $10 per stretch   |
+------------------------------------------------------------------+
|                                                                  |
|  STRETCH 1 (Holes 1-6)                                           |
|  +------------------+------------------------+---------------+   |
|  | Team A           | Score                  | Result        |   |
|  | John & Mike      |   4                    | +$10 each     |   |
|  +------------------+------------------------+---------------+   |
|  | Team B           |   2                    | -$10 each     |   |
|  | Bob & Chris      |                        |               |   |
|  +------------------+------------------------+---------------+   |
|  | Ties: 0 holes                                              |   |
|  +------------------------------------------------------------+   |
|  | PRESS: Team B pressed on Hole 5                            |   |
|  |        Result: Team A wins 2-0 → Team A +$10, Team B -$10  |   |
|  +------------------------------------------------------------+   |
|                                                                  |
|  STRETCH 2 (Holes 7-12)                                          |
|  +------------------+------------------------+---------------+   |
|  | Team A           | Score                  | Result        |   |
|  | John & Bob       |   3                    | PUSH          |   |
|  +------------------+------------------------+---------------+   |
|  | Team B           |   3                    | PUSH          |   |
|  | Mike & Chris     |                        |               |   |
|  +------------------+------------------------+---------------+   |
|  | Ties: 0 holes                                              |   |
|                                                                  |
|  STRETCH 3 (Holes 13-18)                           In Progress   |
|  +------------------+------------------------+---------------+   |
|  | Team A           | Score                  |               |   |
|  | John & Chris     |   2                    |               |   |
|  +------------------+------------------------+---------------+   |
|  | Team B           |   1                    |               |   |
|  | Mike & Bob       |                        |               |   |
|  +------------------+------------------------+---------------+   |
|  | 3 holes remaining                                          |   |
|                                                                  |
+------------------------------------------------------------------+
|  ROUND TOTALS                                                    |
|  +------------+------------+------------+------------+           |
|  | John       | Mike       | Bob        | Chris      |           |
|  | +$20       | +$10       | -$10       | -$20       |           |
|  +------------+------------+------------+------------+           |
+------------------------------------------------------------------+
```

---

### Technical Approach

#### Step 1: Create SixesMatchSummary Component

Create a new component `src/components/sixes/SixesMatchSummary.tsx` that:

1. Displays all 3 stretches in a vertical layout
2. Shows team rosters for each stretch (with name highlighting)
3. Shows match score (e.g., 4-2) with winner indication
4. Shows money won/lost per stretch per player
5. Displays press information:
   - Which team pressed
   - Which hole the press was triggered
   - Press result and payouts
6. Shows a "Round Totals" summary at the bottom

#### Step 2: Data Requirements

The component will use existing engine functions:
- `getSixesTeamAssignment()` - Get team rosters per stretch
- `calculateSixesStretchResult()` - Get holes won by each team
- `calculateSixesStretchPayouts()` - Get player payouts per stretch
- `getSixesPresses()` - Get press info per stretch
- `calculateSixesPressPayouts()` - Get press payout results

#### Step 3: Replace Current 6's Section in Scorecard

Replace the current inline table (lines 723-930) with:

```tsx
{sixesGame && (
  <SixesMatchSummary 
    round={currentRound} 
    game={sixesGame} 
  />
)}
```

---

### Component Structure

```tsx
// src/components/sixes/SixesMatchSummary.tsx

interface SixesMatchSummaryProps {
  round: Round;
  game: GameSettings;
}

const SixesMatchSummary: React.FC<SixesMatchSummaryProps> = ({ round, game }) => {
  // Calculate data for all 3 stretches
  const stretches = [1, 2, 3] as const;
  
  const stretchData = stretches.map(stretch => ({
    stretch,
    assignment: getSixesTeamAssignment(round.gameData, game.id, stretch),
    result: calculateSixesStretchResult(round, game, stretch),
    payouts: calculateSixesStretchPayouts(round, game, stretch),
    presses: getSixesPresses(round.gameData, game.id, stretch),
    pressPayouts: calculateSixesPressPayouts(round, game, stretch),
  }));
  
  // Calculate total payouts across all stretches + presses
  const playerTotals: { [playerId: string]: number } = {};
  
  return (
    <div className="mt-4 bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <h3 className="font-bold text-foreground">6's Match Play Results</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            ${game.unitStake} per stretch
          </span>
        </div>
      </div>
      
      {/* Stretch Cards */}
      <div className="p-4 space-y-4">
        {stretchData.map(data => (
          <StretchCard key={data.stretch} {...data} round={round} />
        ))}
      </div>
      
      {/* Round Totals */}
      <RoundTotalsFooter playerTotals={playerTotals} players={round.players} />
    </div>
  );
};
```

---

### Visual Design for Each Stretch

Each stretch card will include:

| Section | Content |
|---------|---------|
| **Header** | "Stretch 1 (Holes 1-6)" with status badge (Complete/In Progress) |
| **Team A Row** | Player names, match score, money result (+$10 / -$10 / PUSH) |
| **Team B Row** | Player names, match score, money result |
| **Ties Info** | "X holes tied" if any ties occurred |
| **Press Section** | Only shown if presses exist - shows trigger hole, triggering team, and result |

---

### Press Display Design

For each press in a stretch:

```text
┌─────────────────────────────────────────────────────────┐
│ 🔥 PRESS: Team B pressed on Hole 5                      │
│    Holes 5-6: Team A wins 2-0                           │
│    Result: Team A +$10/player, Team B -$10/player       │
└─────────────────────────────────────────────────────────┘
```

Or if still in progress:

```text
┌─────────────────────────────────────────────────────────┐
│ 🔥 PRESS: Team A pressed on Hole 4 (In Progress)        │
│    Current: Team B leads 1-0 (2 holes remaining)        │
└─────────────────────────────────────────────────────────┘
```

---

### Round Totals Footer

A summary showing each player's total winnings/losses from 6's:

```text
┌──────────────────────────────────────────────────────────┐
│  ROUND TOTALS                                            │
├──────────┬──────────┬──────────┬──────────┐              │
│  John    │  Mike    │  Bob     │  Chris   │              │
│  +$30    │  +$10    │  -$20    │  -$20    │              │
│  (3W 0L) │  (2W 1L) │  (0W 3L) │  (1W 2L) │              │
└──────────┴──────────┴──────────┴──────────┘              │
└──────────────────────────────────────────────────────────┘
```

---

### Summary of Files to Change

| File | Change |
|------|--------|
| `src/components/sixes/SixesMatchSummary.tsx` | **NEW** - Create comprehensive match summary component |
| `src/components/sixes/index.ts` | Export new component |
| `src/components/Scorecard.tsx` | Replace current 6's table with new SixesMatchSummary component |

---

### Implementation Details

The new component will:

1. **Always show all 3 stretches** (not dependent on Front/Back toggle)
2. **Handle incomplete stretches** gracefully with "In Progress" status and current score
3. **Show team rotations** clearly - different players on different teams each stretch
4. **Display press details** including:
   - Which player/team triggered the press
   - The hole number where press was triggered
   - The score range the press covers (e.g., "Holes 5-6")
   - Current or final result
   - Money won/lost per player
5. **Calculate totals** by summing all stretch payouts + all press payouts per player

