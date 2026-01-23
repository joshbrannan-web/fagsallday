
## Plan: Default Round Totals Bar to Minimized

### Current Behavior
The bottom bar ("Round Totals / Live Bets") currently:
1. Starts **minimized** only if there's a 6's or Stockton 6's game active
2. Starts **expanded** for all other game types
3. Auto-expands once per stretch (holes 1, 7, 13) after team setup is confirmed for team games

### Requested Change
Make the bar **always default to minimized**, regardless of which games are active. The user can manually expand it at any time using the toggle button.

---

### File to Modify

| File | Changes |
|------|---------|
| `src/components/ActiveRound.tsx` | Simplify initial state to always start minimized |

---

### Detailed Change

#### Update lines 28-35 in `src/components/ActiveRound.tsx`

**Before:**
```typescript
// Start minimized if team games exist (6's or Stockton 6's)
const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(() => {
  if (!currentRound) return false;
  const hasTeamGame = currentRound.games.some(
    g => g.type === GameType.SIXES || g.type === GameType.STOCKTON_6
  );
  return hasTeamGame;
});
```

**After:**
```typescript
// Always start minimized - user can expand at any time
const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(true);
```

---

### Auto-Expand Behavior (Optional Decision)

The current code also auto-expands the bar once per stretch for team games (lines 107-161). 

**Option A: Keep auto-expand** - The bar starts minimized but will still auto-expand once after team setup is confirmed (at holes 1, 7, 13). This helps users see their team assignments and live bets.

**Option B: Remove auto-expand** - The bar stays minimized unless the user manually expands it. This gives full control to the user.

**Recommendation:** Keep the auto-expand behavior for team games (Option A), as it provides useful context after team setup without being intrusive (only happens once per stretch).

---

### Summary

| Aspect | Before | After |
|--------|--------|-------|
| Default state (no team games) | Expanded | Minimized |
| Default state (with team games) | Minimized | Minimized |
| Auto-expand after team setup | Once per stretch | Once per stretch (unchanged) |
| Manual toggle | Always available | Always available |

This is a single-line change that simplifies the initialization logic while maintaining the helpful auto-expand feature for team games.
