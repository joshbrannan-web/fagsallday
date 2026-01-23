

## Plan: Add Round Totals Section for All Games on Scorecard

### Overview
Create a reusable "Round Totals" component that displays per-player financial summaries for each game type, similar to the existing footer in the 6's Match Play Results. This component will be placed:
- **Under the Player Scorecard table** (at the top) for Banker and Bloody Banker games
- **Under each respective game section** for FBO, Stockton 6's, and other games

---

### Current State

The Scorecard currently shows:
1. **Player Scorecard** - Main scoring table with P&L per hole
2. **FBO Dots Section** - Dots per hole + `FBOSegmentResults` component
3. **Stockton 6's Dots Section** - Dots per hole
4. **6's Match Play Section** - `SixesMatchSummary` with its own Round Totals footer

Only 6's has a dedicated Round Totals summary. Other games (Banker, FBO, Stockton 6's) don't show aggregated player-level financial summaries.

---

### Proposed Changes

#### Step 1: Create Reusable GameRoundTotals Component

Create a new component `src/components/GameRoundTotals.tsx` that can display round totals for any game type:

```text
+------------------------------------------------------------------+
|  {Game Name} Round Totals                                        |
+------------+------------+------------+------------+               |
|  Player 1  |  Player 2  |  Player 3  |  Player 4  |               |
|  +$50      |  +$25      |  -$35      |  -$40      |               |
+------------+------------+------------+------------+               |
+------------------------------------------------------------------+
```

**Props:**
- `gameName: string` - Display name (e.g., "Banker", "FBO")
- `playerResults: { [playerId: string]: number }` - Per-player totals
- `players: Player[]` - Player list for names
- `icon?: React.ReactNode` - Optional icon
- `accentColor?: string` - Color theme (e.g., "amber", "primary", "brand-gold")

#### Step 2: Add Round Totals Under Player Scorecard for Banker/Bloody Banker

After the main Player Scorecard table (line ~557), add Round Totals for any Banker or Bloody Banker games:

```tsx
{/* Banker/Bloody Banker Round Totals - placed under main scorecard */}
{currentRound.games
  .filter(g => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER)
  .map(game => {
    const result = calculateBanker(currentRound, game);
    return (
      <GameRoundTotals
        key={game.id}
        gameName={game.name || (game.type === GameType.BLOODY_BANKER ? 'Bloody Banker' : 'Banker')}
        playerResults={result.playerResults}
        players={currentRound.players}
        icon={<Crown className="w-5 h-5 text-brand-gold" />}
        accentColor="brand-gold"
      />
    );
  })}
```

#### Step 3: Add Round Totals Under FBO Section

After `FBOSegmentResults` component (line ~658), add a Round Totals footer:

```tsx
{/* FBO Round Totals */}
{fboGame && (
  <GameRoundTotals
    gameName="FBO"
    playerResults={calculateFBO(currentRound, fboGame).playerResults}
    players={fboPlayers}
    icon={<span className="text-lg">🎱</span>}
    accentColor="primary"
  />
)}
```

#### Step 4: Add Round Totals Under Stockton 6's Section

After the Stockton 6's Dots table (line ~721), add Round Totals:

```tsx
{/* Stockton 6's Round Totals */}
{stockton6Game && (
  <GameRoundTotals
    gameName="Stockton 6's"
    playerResults={calculateStockton6(currentRound, stockton6Game).playerResults}
    players={currentRound.players}
    icon={<span className="text-lg">🎯</span>}
    accentColor="amber"
  />
)}
```

---

### Component Design

```tsx
// src/components/GameRoundTotals.tsx

interface GameRoundTotalsProps {
  gameName: string;
  playerResults: { [playerId: string]: number };
  players: Player[];
  icon?: React.ReactNode;
  accentColor?: 'primary' | 'amber' | 'brand-gold' | 'destructive';
}

const GameRoundTotals: React.FC<GameRoundTotalsProps> = ({
  gameName,
  playerResults,
  players,
  icon,
  accentColor = 'primary'
}) => {
  // Skip if no financial activity
  const hasActivity = Object.values(playerResults).some(v => v !== 0);
  if (!hasActivity) return null;
  
  const colorClasses = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/30', headerBg: 'bg-primary/5' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', headerBg: 'bg-amber-500/5' },
    'brand-gold': { bg: 'bg-brand-gold/10', border: 'border-brand-gold/30', headerBg: 'bg-brand-gold/5' },
    destructive: { bg: 'bg-destructive/10', border: 'border-destructive/30', headerBg: 'bg-destructive/5' }
  };
  
  const colors = colorClasses[accentColor];
  
  return (
    <div className={`mt-4 bg-card rounded-xl shadow-sm border ${colors.border} overflow-hidden`}>
      <div className={`${colors.bg} px-4 py-3 border-b ${colors.border}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-sm text-foreground">{gameName} Round Totals</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {players.slice(0, 4).map(player => {
            const total = playerResults[player.id] || 0;
            return (
              <div 
                key={player.id}
                className={`flex flex-col items-center p-2 rounded-lg ${
                  total > 0 ? 'bg-success/10 border border-success/20' :
                  total < 0 ? 'bg-destructive/10 border border-destructive/20' :
                  'bg-muted/50'
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground truncate max-w-full">
                  {player.name}
                </span>
                <span className={`font-mono font-bold ${
                  total > 0 ? 'text-success' : 
                  total < 0 ? 'text-destructive' : 
                  'text-muted-foreground'
                }`}>
                  {total > 0 ? `+$${total}` : total < 0 ? `-$${Math.abs(total)}` : '$0'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
```

---

### Summary of Files to Change

| File | Change |
|------|--------|
| `src/components/GameRoundTotals.tsx` | **NEW** - Create reusable Round Totals component |
| `src/components/Scorecard.tsx` | Add Round Totals sections for Banker, FBO, and Stockton 6's |

---

### Visual Layout After Changes

```text
┌──────────────────────────────────────────────────────────┐
│  Player Scorecard (Front 9 / Back 9)                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Name  │ 1 │ 2 │ 3 │ ... │ 9 │ Total              │  │
│  │  P&L   │ + │ - │ + │ ... │ + │ $XX               │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  👑 Banker Round Totals                                  │ ← NEW
│  ┌──────┬──────┬──────┬──────┐                           │
│  │ P1   │ P2   │ P3   │ P4   │                           │
│  │ +$40 │ +$15 │ -$25 │ -$30 │                           │
│  └──────┴──────┴──────┴──────┘                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🎱 FBO Dots                                             │
│  (existing table)                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🏆 FBO Results                                          │
│  (existing FBOSegmentResults)                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🎱 FBO Round Totals                                     │ ← NEW
│  ┌──────┬──────┬──────┬──────┐                           │
│  │ P1   │ P2   │ P3   │ P4   │                           │
│  │ +$30 │ -$10 │ -$10 │ -$10 │                           │
│  └──────┴──────┴──────┴──────┘                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🎯 Stockton 6's Dots                                    │
│  (existing table)                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🎯 Stockton 6's Round Totals                            │ ← NEW
│  ┌──────┬──────┬──────┬──────┐                           │
│  │ P1   │ P2   │ P3   │ P4   │                           │
│  │ +$20 │ +$10 │ -$15 │ -$15 │                           │
│  └──────┴──────┴──────┴──────┘                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  ⚔️ 6's Match Play Results                               │
│  (existing SixesMatchSummary with its own Round Totals)  │
└──────────────────────────────────────────────────────────┘
```

---

### Technical Notes

1. **Calculation functions**: Will import `calculateBanker`, `calculateFBO`, and `calculateStockton6` from `gameEngine` and `stockton6Engine` respectively

2. **FBO player subset**: For FBO, the component will only show players participating in FBO (may be a subset of all players)

3. **Multiple Banker games**: If both Banker and Bloody Banker are active, each gets its own Round Totals section

4. **Consistent styling**: The new `GameRoundTotals` component uses the same visual pattern as the existing 6's `RoundTotalsFooter`

5. **No activity handling**: If a game has no financial activity yet (all players at $0), the Round Totals section is hidden

