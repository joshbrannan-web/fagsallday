

## Plan: FBO Head-to-Head Matchup View - Table Layout Update

### Overview
Modify the scorecard to:
1. Display Head-to-Head matchups in a table format similar to the FBO Dots table
2. **Hide** the global FBO Dots table when in Head-to-Head mode (since per-matchup dots are calculated independently)
3. Only show the global FBO Dots table when playing "All Together" mode with multiple players

---

## Part 1: Hide FBO Dots Table in Head-to-Head Mode

### File: `src/components/Scorecard.tsx` (lines 1028-1132)

**Current**: The FBO Dots table is always shown when an FBO game exists.

**Change**: Wrap the FBO Dots table in a conditional that checks if we're NOT in head-to-head mode:

```tsx
{/* FBO Dots Section - Only show for "All Together" mode */}
{fboGame && fboPlayers.length > 0 && 
 !(fboGame.config.fbo?.gameMode === 'headToHead' && 
   fboGame.config.fbo?.headToHeadMatchups?.length > 0) && (
  <>
    <div className="mt-4 inline-block min-w-full bg-card rounded-xl ...">
      {/* Existing FBO Dots table */}
    </div>
  </>
)}
```

This ensures the global dots table (showing who won each hole in the pool) only appears when:
- FBO game exists
- Multiple players are participating
- Game mode is NOT head-to-head

---

## Part 2: Redesign FBOMatchupResults to Use Table Layout

### File: `src/components/Scorecard.tsx` (lines 267-637)

Replace the current card-based layout with a table-style layout that mirrors FBO Dots:

**New Layout Per Matchup:**

```text
+----------------------------------------------------------+
| 🎱 Josh vs Brandon                         $10 per segment |
+----------------------------------------------------------+
| Player   | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Front | Total |
|----------|---|---|---|---|---|---|---|---|---|-------|-------|
| Josh     | ● |   | ● |   |   | ● |   | ● |   |   4   |   7   |
| Brandon  |   | ● |   | ● |   |   | ● |   | ● |   4   |   8   |
+----------------------------------------------------------+
| Segment  | Front 9: TIE | Back 9: Brandon +$10 | Overall: ... |
+----------------------------------------------------------+
```

**Key Changes:**

1. **Header**: Show matchup name and stake per segment
2. **Table Body**: 
   - One row per player showing dots (●) for each hole in current view (Front/Back)
   - Subtotal column for current 9 (Front or Back based on viewMode)
   - Total column for overall 18-hole dots
3. **Results Row**: Compact segment results showing winner and amount
4. **Presses Section**: If any presses exist for this matchup, show below the table

### New Component Structure

```tsx
const FBOMatchupResults: React.FC<FBOMatchupResultsProps> = ({
  fboGame,
  fboPlayers,
  scores,
  gameData,
  courseHoles,
}) => {
  const [viewMode, setViewMode] = useState<'FRONT' | 'BACK'>('FRONT');
  
  // Use parent viewMode passed as prop or manage locally
  const activeHoles = viewMode === 'FRONT' 
    ? courseHoles.filter(h => h.number <= 9)
    : courseHoles.filter(h => h.number > 9);
    
  // ... existing matchup logic
  
  return (
    <div className="mt-4 space-y-6">
      {/* View Mode Toggle (matches main scorecard) */}
      <div className="flex justify-center">
        <div className="bg-card p-1 rounded-xl shadow-sm border border-border flex gap-1">
          <button onClick={() => setViewMode('FRONT')} ...>Front 9</button>
          <button onClick={() => setViewMode('BACK')} ...>Back 9</button>
        </div>
      </div>

      {matchups.map((matchup, idx) => (
        <MatchupTable 
          key={idx}
          matchup={matchup}
          viewMode={viewMode}
          activeHoles={activeHoles}
          {...otherProps}
        />
      ))}

      {/* Overall Summary */}
      {matchups.length > 1 && <MatchupTotalsSummary ... />}
    </div>
  );
};
```

### MatchupTable Component (Internal)

```tsx
const MatchupTable = ({ matchup, viewMode, activeHoles, ... }) => {
  const player1 = fboPlayers.find(p => p.id === matchup.player1Id);
  const player2 = fboPlayers.find(p => p.id === matchup.player2Id);
  
  // Get dots for this matchup using matchupDots data structure
  const getMatchupDotForHole = (holeNum: number): string | null => {
    const matchupDots = fboData[holeNum]?.matchupDots || {};
    const key = `${matchup.player1Id}_${matchup.player2Id}`;
    return matchupDots[key] || null;
  };
  
  return (
    <div className="inline-block min-w-full bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎱</span>
          <h3 className="font-bold text-foreground">{player1.name} vs {player2.name}</h3>
          <span className="text-xs text-muted-foreground ml-auto">${matchup.unitValue} per segment</span>
        </div>
      </div>
      
      {/* Dots Table */}
      <table className="w-full text-center border-collapse text-sm">
        <thead>
          <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
            <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
            {activeHoles.map(h => (
              <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">{h.number}</th>
            ))}
            <th className="p-2 min-w-[50px] bg-muted">{viewMode === 'FRONT' ? 'F9' : 'B9'}</th>
            <th className="p-2 min-w-[50px] bg-primary/10">Total</th>
          </tr>
        </thead>
        <tbody>
          {[player1, player2].map((player, idx) => {
            const subtotalDots = /* count dots for player in active 9 */;
            const totalDots = /* count dots for player overall */;
            
            return (
              <tr key={player.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                  {player.name}
                </td>
                {activeHoles.map(h => {
                  const winner = getMatchupDotForHole(h.number);
                  const hasDot = winner === player.id;
                  return (
                    <td key={h.number} className="p-2 border-r border-border/50">
                      {hasDot ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">●</span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="p-2 font-bold text-foreground">{subtotalDots}</td>
                <td className="p-2 font-bold bg-primary/5 text-primary">{totalDots}</td>
              </tr>
            );
          })}
          
          {/* Results Row */}
          <tr className="bg-muted/50 border-t border-border">
            <td className="p-2 text-left font-semibold text-xs text-muted-foreground sticky left-0 bg-muted/50 border-r border-border z-10">
              Result
            </td>
            <td colSpan={activeHoles.length} className="p-2 text-center">
              {/* Show compact segment result */}
              <div className="flex items-center justify-center gap-4 text-xs">
                <span>
                  Front 9: {frontResult.status === 'pending' ? 'In Progress' : 
                           frontResult.status === 'push' ? 'Push' :
                           `${winnerName} +$${matchup.unitValue}`}
                </span>
                <span>Back 9: ...</span>
                <span>Overall: ...</span>
              </div>
            </td>
            <td className="p-2 font-bold text-foreground"></td>
            <td className="p-2 font-bold bg-primary/5">
              {/* Total P&L for this matchup */}
            </td>
          </tr>
        </tbody>
      </table>
      
      {/* Presses Section (if any) */}
      {matchupPresses.length > 0 && (
        <div className="border-t border-border p-4">
          {/* Existing press display logic */}
        </div>
      )}
    </div>
  );
};
```

---

## Part 3: Pass ViewMode to FBOMatchupResults

### File: `src/components/Scorecard.tsx` (around line 642)

Since the main scorecard already has a `viewMode` state, pass it to `FBOMatchupResults`:

```tsx
const Scorecard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'FRONT' | 'BACK'>('FRONT');
  // ...
  
  return (
    // ...
    {fboGame.config.fbo?.gameMode === 'headToHead' && 
     fboGame.config.fbo?.headToHeadMatchups?.length > 0 ? (
      <FBOMatchupResults 
        fboGame={fboGame}
        fboPlayers={fboPlayers}
        scores={currentRound.scores}
        gameData={currentRound.gameData}
        courseHoles={holes}
        viewMode={viewMode}  // NEW PROP
      />
    ) : (
      // FBOSegmentResults...
    )}
  );
};
```

Update `FBOMatchupResultsProps` interface:

```tsx
interface FBOMatchupResultsProps {
  fboGame: GameSettings;
  fboPlayers: Player[];
  scores: { [holeNumber: number]: HoleScores };
  gameData: GameData;
  courseHoles: Hole[];
  viewMode: 'FRONT' | 'BACK';  // NEW
}
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/components/Scorecard.tsx` | 1. Add `viewMode` prop to `FBOMatchupResultsProps`<br>2. Rewrite `FBOMatchupResults` to use table layout matching FBO Dots<br>3. Wrap global FBO Dots table in conditional to hide for H2H mode<br>4. Pass `viewMode` from parent to `FBOMatchupResults` |

---

## Visual Comparison

### Before (Card Layout):
```
+--------------------------------+
| Josh vs Brandon    $10/segment |
+--------------------------------+
| Player  | F9 | B9 | Overall    |
|---------|----|----|------------|
| Josh    |  3 |  4 |     7      |
| Brandon |  2 |  3 |     5      |
+--------------------------------+
```

### After (Table Layout - matches FBO Dots):
```
+------------------------------------------------+
| 🎱 Josh vs Brandon                 $10/segment |
+------------------------------------------------+
| Player  | 1 | 2 | 3 | ... | 9 | F9 | Total    |
|---------|---|---|---|-----|---|----| ---------|
| Josh    | ● |   | ● | ... |   |  4 |    7     |
| Brandon |   | ● |   | ... | ● |  3 |    5     |
+------------------------------------------------+
| Result: Front 9: Josh +$10 | Back 9: ... | ... |
+------------------------------------------------+
```

---

## Expected Outcome

After implementation:

1. **Head-to-Head mode**: 
   - Global FBO Dots table is hidden
   - Each matchup displayed as its own table showing per-hole dots
   - Dots calculated independently for each 1v1 pairing (using matchupDots)
   - Segment results shown compactly below the table
   - Presses shown in expandable section

2. **All Together mode**:
   - Global FBO Dots table shown (existing behavior)
   - FBOSegmentResults shown (existing behavior)
   - All players compete in same pool

