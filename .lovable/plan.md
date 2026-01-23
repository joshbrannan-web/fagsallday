
## Plan: Remove Auto-Expand for Round Totals Bar

### Summary
Remove the auto-expand behavior entirely so the Round Totals bar only expands when the user manually clicks the toggle button. This gives full control to the user.

---

### Changes to Make

| File | Changes |
|------|---------|
| `src/components/ActiveRound.tsx` | Remove auto-expand logic and related state |

---

### Detailed Changes

#### 1. Remove the `autoExpandedStretches` state (line 32)

**Delete:**
```typescript
// Track which stretches have already auto-expanded (to avoid overriding user's manual minimize)
const [autoExpandedStretches, setAutoExpandedStretches] = useState<Set<string>>(new Set());
```

#### 2. Remove the entire auto-expand `useEffect` hook (lines 101-155)

**Delete the entire block:**
```typescript
// Auto-expand bottom bar once teams are confirmed for the current stretch (only once per stretch)
useEffect(() => {
  if (!currentRound) return;
  
  const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);
  const sixesGame = currentRound.games.find(g => g.type === GameType.SIXES);
  
  // If no team games, leave bar as-is
  if (!stockton6Game && !sixesGame) return;
  
  // Build stretch keys and check if teams are locked
  const stretchKeys: string[] = [];
  let teamsLockedForCurrentStretch = true;
  
  if (stockton6Game) {
    const stretch = getStretchForHole(activeHole);
    const teamAssignment = getTeamAssignment(currentRound.gameData, stockton6Game.id, stretch);
    if (teamAssignment) {
      stretchKeys.push(`stockton6_${stretch}`);
    } else {
      teamsLockedForCurrentStretch = false;
    }
  }
  
  if (sixesGame) {
    const stretch = getSixesStretchForHole(activeHole);
    const teamAssignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch);
    if (teamAssignment) {
      stretchKeys.push(`sixes_${stretch}`);
    } else {
      teamsLockedForCurrentStretch = false;
    }
  }
  
  // Only auto-expand if teams are locked AND we haven't already expanded for this stretch
  if (teamsLockedForCurrentStretch && stretchKeys.length > 0) {
    const alreadyExpanded = stretchKeys.every(key => autoExpandedStretches.has(key));
    
    if (!alreadyExpanded && isBottomBarMinimized) {
      setIsBottomBarMinimized(false);
      setAutoExpandedStretches(prev => {
        const newSet = new Set(prev);
        stretchKeys.forEach(key => newSet.add(key));
        return newSet;
      });
    } else if (!alreadyExpanded) {
      // Mark as expanded even if bar was already open
      setAutoExpandedStretches(prev => {
        const newSet = new Set(prev);
        stretchKeys.forEach(key => newSet.add(key));
        return newSet;
      });
    }
  }
}, [currentRound?.gameData, activeHole, isBottomBarMinimized, autoExpandedStretches]);
```

---

### Result

| Aspect | Before | After |
|--------|--------|-------|
| Default state | Minimized | Minimized |
| Auto-expand after team setup | Once per stretch | **Removed** |
| Manual toggle | Always available | Always available |

The Round Totals bar will now stay minimized unless the user explicitly expands it.
