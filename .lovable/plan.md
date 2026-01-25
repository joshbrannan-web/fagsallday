

## Plan: Replace P&L Label with Course Handicap

### Overview
Update the scorecard to show each player's course handicap in the row label instead of "P&L". This consolidates information and makes the handicap easily visible.

---

### Current State

**Line 511:**
```tsx
<td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">P&L</td>
```

Displays a static "P&L" label for the profit/loss row.

---

### Proposed Change

Replace the static "P&L" text with the player's course handicap:

**Before:**
```
+------------------+------+------+------+------+
| John Smith       | 4    | 5    | 3    | 82   |
| P&L              | +5   | -    | +10  | $15  |
+------------------+------+------+------+------+
```

**After:**
```
+------------------+------+------+------+------+
| John Smith       | 4    | 5    | 3    | 82   |
| HCP 14           | +5   | -    | +10  | $15  |
+------------------+------+------+------+------+
```

---

### Technical Implementation

**File:** `src/components/Scorecard.tsx`

**Line 511:** Change from static "P&L" to dynamic course handicap

```tsx
// Before
<td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">P&L</td>

// After
<td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">HCP {player.courseHandicap}</td>
```

Since this row is already inside the `currentRound.players.map((player, idx) => ...)` loop, the `player` object is accessible and contains `courseHandicap`.

---

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/components/Scorecard.tsx` | 511 | Replace `P&L` with `HCP {player.courseHandicap}` |

