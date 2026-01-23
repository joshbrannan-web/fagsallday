

## Plan: Fix Press Availability - Only Show When Past Dormie

### Overview
Update the dormie detection logic for both 6's and FBO games so that the Press button only appears when a player/team is **past dormie** (strictly behind and cannot catch up), not when they are exactly dormie (could at best tie).

---

### Current Behavior

| Game | Current Check | What It Means |
|------|---------------|---------------|
| 6's | `teamWins + holesRemaining <= opponentWins` | Press shows when can at best TIE (dormie) |
| FBO | `playerDots + holesRemaining < leaderDots` | Press shows when strictly behind (already correct) |

**Example for 6's:**
- Team A has 2 wins, Team B has 4 wins, 2 holes remain
- Current: 2 + 2 = 4, so 4 <= 4 is TRUE → Press available (Team A can at best tie)
- Desired: 2 + 2 = 4, so 4 < 4 is FALSE → No Press yet (Team A could still tie)

---

### Desired Behavior

| Game | New Check | What It Means |
|------|-----------|---------------|
| 6's | `teamWins + holesRemaining < opponentWins` | Press only when strictly cannot catch up |
| FBO | `playerDots + holesRemaining < leaderDots` | Already correct - no change needed |

**Key distinction:**
- **Dormie** = Best possible outcome is a tie (can't WIN)
- **Past Dormie** = Can't even tie (already lost)

The user wants Press available only when "past dormie" (strictly behind).

---

### Changes Required

| File | Lines | Change |
|------|-------|--------|
| `src/services/sixesEngine.ts` | 68 | Change `<=` to `<` in `isSixesTeamDormie` |
| `src/services/gameEngine.ts` | - | **No change needed** - FBO already uses `<` |

---

### Technical Details

#### Change in `src/services/sixesEngine.ts` (line 68)

**Current code:**
```typescript
export const isSixesTeamDormie = (
  teamWins: number,
  opponentWins: number,
  holesRemaining: number
): boolean => {
  // Team is dormie if even winning all remaining holes wouldn't beat opponent
  return teamWins + holesRemaining <= opponentWins;  // <= includes "can only tie"
};
```

**New code:**
```typescript
export const isSixesTeamDormie = (
  teamWins: number,
  opponentWins: number,
  holesRemaining: number
): boolean => {
  // Team is past dormie if even winning all remaining holes wouldn't catch opponent
  return teamWins + holesRemaining < opponentWins;  // < means strictly behind
};
```

---

### FBO Verification

The FBO logic in `src/services/gameEngine.ts` already uses the correct check:
```typescript
return playerDots + holesRemaining < leaderDots;  // Already uses <
```

This means FBO Press is already only available when strictly behind. **No changes needed for FBO.**

---

### Example Scenarios After Fix

#### 6's Game (6-hole stretch):

| Team A Wins | Team B Wins | Holes Left | A's Best | Can A Press? |
|-------------|-------------|------------|----------|--------------|
| 2 | 4 | 2 | 4 (tie) | NO (can still tie) |
| 1 | 4 | 2 | 3 | YES (can't catch up) |
| 0 | 4 | 3 | 3 | YES (can't catch up) |
| 2 | 3 | 2 | 4 (win) | NO (can still win) |

---

### Summary

A single character change from `<=` to `<` in the 6's engine function will ensure Press is only available when truly "past dormie" - when a team is mathematically eliminated with no chance of even tying.

