
## Plan: Fix FBO Head-to-Head Press Detection

### Problem Summary
The FBO Press UI is not appearing for Brandon even though he is "past dormie" in his matchups against Josh and Clint. This is because:

1. **Dormie detection uses global `dots` array**: The functions `getFBODormieStatus` and `getFBOOverallDormieStatus` read from `fboData[h]?.dots` which contains global pool winners
2. **Head-to-Head mode uses `matchupDots`**: In H2H mode, dot results are stored per-matchup in `matchupDots` (e.g., `{ "1_2": "1", "2_3": "3" }`)
3. **Data mismatch**: Since `dots` is empty/undefined in H2H mode, no player is ever detected as dormie

### Current Data (Hole 8)
| Matchup | Player 1 Dots | Player 2 Dots | Status |
|---------|---------------|---------------|--------|
| Josh (1) vs Brandon (2) | 7 | 0 | Brandon is past dormie (2 holes left, 7 behind) |
| Josh (1) vs Clint (3) | 3 | 0 | Clint is dormie (needs 4 in 2 holes) |
| Brandon (2) vs Clint (3) | 0 | 7 | Brandon is past dormie (2 holes left, 7 behind) |

---

## Solution

Add Head-to-Head specific dormie detection functions that read from `matchupDots` instead of `dots`, and update the ActiveRound UI to use these functions for H2H games.

---

## Implementation Details

### Part 1: Add H2H Dormie Detection Functions

**File:** `src/services/gameEngine.ts`

Add new functions for Head-to-Head dormie detection:

```typescript
// Get dormie status for a specific H2H matchup in a segment
export const getFBOMatchupDormieStatus = (
  round: Round,
  game: GameSettings,
  player1Id: string,
  player2Id: string,
  currentHole: number
): { 
  player1: { isDormie: boolean; dotsBehind: number; holesRemaining: number; segment: 'front' | 'back' };
  player2: { isDormie: boolean; dotsBehind: number; holesRemaining: number; segment: 'front' | 'back' };
} => {
  const fboData = round.gameData?.[game.id] || {};
  const segment: 'front' | 'back' = currentHole <= 9 ? 'front' : 'back';
  const segmentStart = segment === 'front' ? 1 : 10;
  const segmentEnd = segment === 'front' ? 9 : 18;
  const holesRemaining = segmentEnd - currentHole + 1;
  
  // Build matchup key (try both orderings)
  const key1 = `${player1Id}_${player2Id}`;
  const key2 = `${player2Id}_${player1Id}`;
  
  // Count dots from matchupDots
  let p1Dots = 0, p2Dots = 0;
  for (let h = segmentStart; h < currentHole; h++) {
    const matchupDots = fboData[h]?.matchupDots || {};
    const winner = matchupDots[key1] ?? matchupDots[key2];
    if (String(winner) === String(player1Id)) p1Dots++;
    if (String(winner) === String(player2Id)) p2Dots++;
  }
  
  return {
    player1: {
      isDormie: p1Dots + holesRemaining < p2Dots,
      dotsBehind: Math.max(0, p2Dots - p1Dots),
      holesRemaining,
      segment
    },
    player2: {
      isDormie: p2Dots + holesRemaining < p1Dots,
      dotsBehind: Math.max(0, p1Dots - p2Dots),
      holesRemaining,
      segment
    }
  };
};

// Get Overall dormie status for a specific H2H matchup (holes 1-18)
export const getFBOMatchupOverallDormieStatus = (
  round: Round,
  game: GameSettings,
  player1Id: string,
  player2Id: string,
  currentHole: number
): { 
  player1: { isDormie: boolean; dotsBehind: number; holesRemaining: number };
  player2: { isDormie: boolean; dotsBehind: number; holesRemaining: number };
} => {
  const fboData = round.gameData?.[game.id] || {};
  const holesRemaining = 18 - currentHole + 1;
  
  const key1 = `${player1Id}_${player2Id}`;
  const key2 = `${player2Id}_${player1Id}`;
  
  let p1Dots = 0, p2Dots = 0;
  for (let h = 1; h < currentHole; h++) {
    const matchupDots = fboData[h]?.matchupDots || {};
    const winner = matchupDots[key1] ?? matchupDots[key2];
    if (String(winner) === String(player1Id)) p1Dots++;
    if (String(winner) === String(player2Id)) p2Dots++;
  }
  
  return {
    player1: {
      isDormie: p1Dots + holesRemaining < p2Dots,
      dotsBehind: Math.max(0, p2Dots - p1Dots),
      holesRemaining
    },
    player2: {
      isDormie: p2Dots + holesRemaining < p1Dots,
      dotsBehind: Math.max(0, p1Dots - p2Dots),
      holesRemaining
    }
  };
};

// Get H2H press eligibility for a specific matchup
export const getFBOMatchupPressEligibility = (
  round: Round,
  game: GameSettings,
  playerId: string,
  opponentId: string,
  segment: 'front' | 'back',
  currentHole: number
): { canPress: boolean; pressLevel: number; reason?: string } => {
  const fboGameData = round.gameData?.[game.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  
  // Find presses for this specific matchup and segment
  const matchupPresses = presses.filter(p => 
    String(p.playerId) === String(playerId) &&
    String(p.opponentId) === String(opponentId) &&
    p.segment === segment
  );
  
  if (matchupPresses.length === 0) {
    // Check base dormie status for this matchup
    const dormieStatus = getFBOMatchupDormieStatus(round, game, playerId, opponentId, currentHole);
    const playerStatus = dormieStatus.player1; // player1 is always the first arg
    if (!playerStatus.isDormie) {
      return { canPress: false, pressLevel: 1, reason: 'Not dormie in matchup' };
    }
    return { canPress: true, pressLevel: 1 };
  }
  
  // Has existing press - check if still dormie
  const latestPress = matchupPresses.reduce((a, b) => 
    a.startHole > b.startHole ? a : b
  );
  
  const nextPressLevel = (latestPress.pressLevel || 1) + 1;
  
  if (latestPress.startHole >= currentHole) {
    return { canPress: false, pressLevel: nextPressLevel, reason: 'Already pressed this hole' };
  }
  
  // Check dormie on the press
  // ... (implement dormie-on-press logic for matchups)
  
  return { canPress: true, pressLevel: nextPressLevel };
};
```

---

### Part 2: Update FBO Press UI for Head-to-Head Mode

**File:** `src/components/ActiveRound.tsx` (around lines 1090-1220)

Add conditional logic to detect H2H mode and render per-matchup press buttons:

```typescript
{fboGames.filter(g => g.config.fbo?.allowPresses).map(fboGame => {
  const isHeadToHead = fboGame.config.fbo?.gameMode === 'headToHead';
  const matchups = fboGame.config.fbo?.headToHeadMatchups || [];
  
  if (isHeadToHead && matchups.length > 0) {
    // HEAD-TO-HEAD MODE: Check dormie per matchup
    const segment: 'front' | 'back' = activeHole <= 9 ? 'front' : 'back';
    const onBackNine = activeHole > 9;
    const segmentStartHole = activeHole <= 9 ? 1 : 10;
    if (activeHole === segmentStartHole) return null;
    
    // Build list of pressable matchups
    const pressableMatchups: Array<{
      matchup: HeadToHeadMatchup;
      dormiePlayerId: string;
      opponentId: string;
      dormiePlayerName: string;
      opponentName: string;
      dotsBehind: number;
      holesRemaining: number;
      pressLevel: number;
      canPressSegment: boolean;
      canPressOverall: boolean;
    }> = [];
    
    matchups.forEach(matchup => {
      const p1 = currentRound.players.find(p => String(p.id) === String(matchup.player1Id));
      const p2 = currentRound.players.find(p => String(p.id) === String(matchup.player2Id));
      if (!p1 || !p2) return;
      
      const dormieStatus = getFBOMatchupDormieStatus(
        currentRound, fboGame, matchup.player1Id, matchup.player2Id, activeHole
      );
      
      // Check if player1 is dormie
      if (dormieStatus.player1.isDormie) {
        pressableMatchups.push({
          matchup,
          dormiePlayerId: matchup.player1Id,
          opponentId: matchup.player2Id,
          dormiePlayerName: p1.name,
          opponentName: p2.name,
          dotsBehind: dormieStatus.player1.dotsBehind,
          holesRemaining: dormieStatus.player1.holesRemaining,
          pressLevel: 1, // TODO: Check existing presses
          canPressSegment: true,
          canPressOverall: onBackNine // Check overall dormie too
        });
      }
      
      // Check if player2 is dormie
      if (dormieStatus.player2.isDormie) {
        pressableMatchups.push({
          matchup,
          dormiePlayerId: matchup.player2Id,
          opponentId: matchup.player1Id,
          dormiePlayerName: p2.name,
          opponentName: p1.name,
          dotsBehind: dormieStatus.player2.dotsBehind,
          holesRemaining: dormieStatus.player2.holesRemaining,
          pressLevel: 1,
          canPressSegment: true,
          canPressOverall: onBackNine
        });
      }
    });
    
    if (pressableMatchups.length === 0) return null;
    
    return (
      <div key={fboGame.id} className="bg-card rounded-2xl shadow-sm border border-amber-500/50 p-4 mb-4">
        <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
          <span className="bg-amber-500/20 text-amber-500 p-1.5 rounded text-lg">🎱</span>
          FBO H2H Press Available
        </h3>
        <div className="space-y-3">
          {pressableMatchups.map((pm, idx) => (
            <div key={idx} className="p-3 bg-amber-500/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {pm.dormiePlayerName} vs {pm.opponentName}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({pm.dotsBehind} behind, {pm.holesRemaining} left)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFBOPress(
                    fboGame.id, 
                    pm.dormiePlayerId, 
                    segment, 
                    pm.pressLevel, 
                    pm.opponentId
                  )}
                  className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold"
                >
                  Press {segment === 'front' ? 'F9' : 'B9'}
                  <span className="block text-xs opacity-80">${pm.matchup.unitValue}</span>
                </button>
                {pm.canPressOverall && (
                  <button
                    onClick={() => handleFBOPress(
                      fboGame.id,
                      pm.dormiePlayerId,
                      'overall',
                      pm.pressLevel,
                      pm.opponentId
                    )}
                    className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-bold"
                  >
                    Press Overall
                    <span className="block text-xs opacity-80">${pm.matchup.unitValue}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // ALL TOGETHER MODE: Existing logic (unchanged)
    // ...
  }
})}
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/services/gameEngine.ts` | Add `getFBOMatchupDormieStatus`, `getFBOMatchupOverallDormieStatus`, and `getFBOMatchupPressEligibility` functions for H2H mode |
| `src/components/ActiveRound.tsx` | Update FBO Press UI section to detect H2H mode and render per-matchup press buttons using new dormie functions |

---

## Expected Outcome

After implementation:
1. Brandon will see press buttons for both his matchups:
   - "Brandon vs Josh" - Press B9 / Press Overall
   - "Brandon vs Clint" - Press B9 / Press Overall
2. The press will be stored with `opponentId` so settlement knows which matchup it applies to
3. Each matchup press is independent - Brandon can press Josh but not Clint (or vice versa) if their dormie statuses differ
