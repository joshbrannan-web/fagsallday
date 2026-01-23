

## Plan: Add Per-Game Breakdown to Round Totals Bar

### Overview
Enhance the Round Totals bar in ActiveRound to show a detailed breakdown of money won/lost per game, not just the overall total. This will display each active game's contribution (Banker, 6's, FBO, Skins, etc.) in separate rows.

---

### Current Behavior
The Round Totals bar currently shows:
- Player initials (avatar circles)
- Total strokes
- Overall money total (aggregated from all games)

### Desired Behavior
Show a vertical breakdown like:
```
Player Names    J  /  B  /  C  /  M
Total Strokes  35 / 45 / 47 / 52
Banker        +32 / -32 / +12 / -12
6's           +10 / +10 / -10 / -10
FBO           +10 / -10 /  -  /  -
All Total     +52 / -32 / +2  / -22
```

---

### Technical Approach

#### Step 1: Create a Helper Function for Per-Game Results

Add a new function `calculatePerGameTotals` to `src/services/gameEngine.ts` that returns results per game (not aggregated):

```typescript
export const calculatePerGameTotals = (round: Round): { 
  gameId: string; 
  gameName: string; 
  gameType: GameType;
  playerResults: { [playerId: string]: number } 
}[] => {
  // For each game in round.games, calculate and return individual results
};
```

This will return an array of game results with their display names and per-player totals.

#### Step 2: Modify ActiveRound.tsx Bottom Bar UI

Update the expanded state (lines 1464-1491) to:
1. Call the new per-game calculation function
2. Render each game as a separate row with player-specific amounts
3. Add a final "Total" row with the sum

---

### Detailed Changes

| File | Lines | Change |
|------|-------|--------|
| `src/services/gameEngine.ts` | After `calculateRoundTotals` (~1183) | Add `calculatePerGameTotals` function |
| `src/components/ActiveRound.tsx` | ~1464-1491 | Update bottom bar expanded content to show per-game breakdown |

#### New Function: `calculatePerGameTotals`

```typescript
export const calculatePerGameTotals = (round: Round): {
  gameId: string;
  gameName: string;
  gameType: GameType;
  playerResults: { [playerId: string]: number };
}[] => {
  const results: {
    gameId: string;
    gameName: string;
    gameType: GameType;
    playerResults: { [playerId: string]: number };
  }[] = [];

  round.games.forEach((game) => {
    let result: GameResult;

    switch (game.type) {
      case GameType.SKINS:
        result = calculateSkins(round, game);
        break;
      case GameType.NASSAU:
        result = calculateNassau(round, game);
        break;
      case GameType.OPEN_BETTING:
        result = calculateOpenBetting(round, game);
        break;
      case GameType.BANKER:
      case GameType.BLOODY_BANKER:
        result = calculateBanker(round, game);
        break;
      case GameType.FBO:
        result = calculateFBO(round, game);
        break;
      case GameType.STOCKTON_6:
        result = calculateStockton6(round, game);
        break;
      case GameType.WOLF:
        result = calculateWolf(round, game);
        break;
      case GameType.NINE_POINTS:
        result = calculateNinePoints(round, game);
        break;
      case GameType.SIXES:
        result = calculateSixes(round, game);
        break;
      default:
        return;
    }

    results.push({
      gameId: game.id,
      gameName: game.name,
      gameType: game.type,
      playerResults: result.playerResults,
    });
  });

  return results;
};
```

#### Updated Bottom Bar UI

Replace the current expanded content with:

```tsx
{!isBottomBarMinimized && (
  <>
    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground mb-2">
      <span>Round Totals</span>
      <span>Live Bets</span>
    </div>
    
    {/* Header row with player initials */}
    <div className="flex gap-4 overflow-x-auto no-scrollbar mb-2">
      {currentRound.players.map(p => (
        <div key={p.id} className="flex flex-col items-center min-w-[60px]">
          <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-bold border border-border">
            {p.name.substring(0, 2).toUpperCase()}
          </div>
        </div>
      ))}
    </div>

    {/* Strokes row */}
    <div className="flex gap-4 overflow-x-auto no-scrollbar mb-1">
      <div className="min-w-[60px] text-[10px] text-muted-foreground font-bold uppercase">Strokes</div>
      {currentRound.players.map(p => (
        <div key={p.id} className="flex flex-col items-center min-w-[60px]">
          <span className="text-xs font-mono text-muted-foreground">{getPlayerTotalGross(p.id)}</span>
        </div>
      ))}
    </div>

    {/* Per-game rows */}
    {calculatePerGameTotals(currentRound).map(gameResult => {
      // Skip games where all players have $0
      const hasActivity = Object.values(gameResult.playerResults).some(v => v !== 0);
      if (!hasActivity) return null;
      
      // Determine display name
      const displayName = getGameDisplayName(gameResult.gameType);
      
      return (
        <div key={gameResult.gameId} className="flex gap-4 overflow-x-auto no-scrollbar mb-1">
          <div className="min-w-[60px] text-[10px] text-muted-foreground font-bold uppercase truncate">{displayName}</div>
          {currentRound.players.map(p => {
            const amount = gameResult.playerResults[p.id] || 0;
            // Check if player participates in this game (for FBO which may be subset)
            const participates = gameResult.gameType !== GameType.FBO || 
              currentRound.games.find(g => g.id === gameResult.gameId)?.config.fboPlayers?.includes(p.id);
            
            return (
              <div key={p.id} className="flex flex-col items-center min-w-[60px]">
                {participates ? (
                  <span className={`text-xs font-mono font-bold ${amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {amount > 0 ? '+' : amount < 0 ? '-' : ''}${Math.abs(amount)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            );
          })}
        </div>
      );
    })}

    {/* Total row */}
    <div className="flex gap-4 overflow-x-auto no-scrollbar pt-2 border-t border-border mt-2">
      <div className="min-w-[60px] text-[10px] text-foreground font-bold uppercase">Total</div>
      {currentRound.players.map(p => {
        const total = roundTotals[p.id] || 0;
        return (
          <div key={p.id} className="flex flex-col items-center min-w-[60px]">
            <span className={`text-sm font-mono font-bold ${total > 0 ? 'text-success' : total < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {total > 0 ? '+' : total < 0 ? '-' : ''}${Math.abs(total)}
            </span>
          </div>
        );
      })}
    </div>
  </>
)}
```

#### Game Display Name Helper

```typescript
const getGameDisplayName = (type: GameType): string => {
  switch (type) {
    case GameType.BANKER:
    case GameType.BLOODY_BANKER:
      return 'Banker';
    case GameType.SIXES:
      return "6's";
    case GameType.STOCKTON_6:
      return "Stockton 6's";
    case GameType.FBO:
      return 'FBO';
    case GameType.SKINS:
      return 'Skins';
    case GameType.NASSAU:
      return 'Nassau';
    case GameType.WOLF:
      return 'Wolf';
    case GameType.NINE_POINTS:
      return '9 Points';
    case GameType.OPEN_BETTING:
      return 'Side Bets';
    default:
      return type;
  }
};
```

---

### Visual Layout

```text
+--------+------+------+------+------+
|        |  JO  |  BR  |  CL  |  MO  |
+--------+------+------+------+------+
| Strokes|  35  |  45  |  47  |  52  |
| Banker | +112 | -27  | -38  | -47  |
| 6's    | +10  | +10  | -10  | -10  |
| FBO    | +10  | -10  |  -   |  -   |
+--------+------+------+------+------+
| Total  | +132 | -27  | -48  | -57  |
+--------+------+------+------+------+
```

---

### Summary of Files to Change

| File | Change |
|------|--------|
| `src/services/gameEngine.ts` | Add `calculatePerGameTotals` function |
| `src/components/ActiveRound.tsx` | Import `calculatePerGameTotals`, add `getGameDisplayName` helper, update expanded bottom bar content |

