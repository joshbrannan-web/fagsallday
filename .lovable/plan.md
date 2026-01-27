

## Plan: Fix Share Image to Capture All 18 Holes

### Problem
The current `scorecardRef` targets a `div` that renders a table with only `activeHoles` (either Front 9 or Back 9 based on `viewMode`). When `handleShareImage` is called, it only captures the currently visible 9 holes, not the full 18-hole scorecard.

### Solution
Create a hidden, full-width scorecard table specifically for image capture that always renders all 18 holes. This hidden element will be targeted by the `scorecardRef`, while the visible scorecard continues to show the Front/Back 9 toggle behavior.

---

### Implementation

**File:** `src/components/Scorecard.tsx`

#### Step 1: Create a Separate Ref for the Hidden Full Scorecard

```tsx
const scorecardRef = useRef<HTMLDivElement>(null);  // For hidden 18-hole capture
```

#### Step 2: Add Hidden Full 18-Hole Scorecard for Image Capture

Add a hidden `div` (positioned offscreen or with `sr-only` class) that renders the complete 18-hole scorecard. This element will be used exclusively for image capture.

**Key characteristics:**
- Render all 18 holes in a single row (no Front/Back toggle)
- Include the course name and date header
- Include player scores, money P&L, and banker crowns
- Style identically to the visible scorecard
- Hidden from view using absolute positioning offscreen

#### Step 3: Structure of Hidden Scorecard

```tsx
{/* Hidden full 18-hole scorecard for image capture */}
<div 
  ref={scorecardRef}
  className="absolute left-[-9999px] top-0"
  aria-hidden="true"
>
  <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
    {/* Header */}
    <div className="bg-muted/50 px-4 py-3 border-b border-border">
      <div className="text-center">
        <h3 className="font-bold text-foreground text-lg">{currentRound.course.name}</h3>
        <p className="text-xs text-muted-foreground">
          {new Date(currentRound.startTime).toLocaleDateString(...)}
        </p>
      </div>
    </div>
    
    {/* Full 18-hole table */}
    <table className="w-full text-center border-collapse text-sm">
      <thead>
        <tr>
          <th>Player</th>
          {holes.map(h => (  // ALL 18 holes
            <th key={h.number}>
              {h.number}
              <div>par {h.par}</div>
              <div>IDX {h.handicapIndex}</div>
            </th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {currentRound.players.map((player, idx) => (
          <React.Fragment key={player.id}>
            {/* Score row */}
            <tr>
              <td>{player.name}</td>
              {holes.map(h => (  // ALL 18 holes
                <td key={h.number}>
                  {/* Score with birdie/bogey styling, stroke dot, banker crown */}
                </td>
              ))}
              <td>{totalScore}</td>
            </tr>
            {/* Money row */}
            <tr>
              <td>HCP {player.courseHandicap}</td>
              {holes.map(h => (  // ALL 18 holes
                <td key={h.number}>
                  {/* Per-hole money */}
                </td>
              ))}
              <td>{roundTotals[player.id]}</td>
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

#### Step 4: Remove Ref from Visible Scorecard

The visible scorecard (lines 490-616) will no longer have the `scorecardRef`. It continues to work as before with the Front/Back toggle.

#### Step 5: Calculate Full 18-Hole Totals

Add a helper to calculate the total score across all 18 holes for each player:

```tsx
const calculateTotalScore = (pid: string) => {
  let total = 0;
  holes.forEach(h => {
    const s = currentRound.scores[h.number]?.[pid];
    if (typeof s === 'number') total += s;
  });
  return total;
};
```

---

### Summary of Changes

| Location | Change |
|----------|--------|
| Line 264 | Keep `scorecardRef` but now targets hidden element |
| Line 490 | Remove `ref={scorecardRef}` from visible scorecard |
| After line 616 | Add new hidden full 18-hole scorecard with `ref={scorecardRef}` |
| New helper | Add `calculateTotalScore(pid)` for 18-hole totals |

---

### Technical Notes

**Why offscreen instead of `display: none`?**
- `html-to-image` cannot capture elements with `display: none`
- Positioning offscreen (`left: -9999px`) keeps the element in the DOM and renderable while hiding it from users

**Styling consistency:**
- The hidden scorecard uses the exact same classes and styling as the visible one
- Scores get birdie/bogey coloring, stroke dots, and banker crowns
- Money row shows per-hole P&L with green/red coloring

**Image dimensions:**
- With all 18 holes, the image will be wide (landscape-optimized)
- `pixelRatio: 2` ensures crisp rendering when shared

