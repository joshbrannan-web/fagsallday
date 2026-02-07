

## Plan: Favorite Rounds, Locked Rounds in Recent, and Bogey/Double-Bogey Outlines

Three changes across the database, round history, and scorecard views.

---

### Feature 1: Favorite a Locked Round

Add the ability to mark any round (especially locked ones) as a favorite.

**Database Migration**

Add an `is_favorite` boolean column to the `rounds` table:

```sql
ALTER TABLE rounds ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
```

**File: `src/types.ts`**

Add `isFavorite?: boolean` to the `Round` interface.

**File: `src/hooks/useRounds.tsx`**

- Map `is_favorite` from DB to `isFavorite` in `dbRoundToRound`
- Add a `toggleRoundFavorite` function that updates the `is_favorite` column in the database and local state
- Expose `toggleRoundFavorite` in the return object

**File: `src/contexts/AppContext.tsx`**

Add `toggleRoundFavorite: (roundId: string) => void` to the `AppState` interface.

**File: `src/App.tsx`**

Wire `toggleRoundFavorite` from `useRounds` through the app context for both authenticated and local users.

**File: `src/components/RoundHistory.tsx`**

- Add a Star/Heart icon button on each `RoundCard` to toggle favorite status
- Favorite rounds get a filled star icon; non-favorites get an outline star
- The favorite button is accessible on all round cards (not just locked ones, but especially useful for locked rounds)
- Add a "Favorites" section at the top of the history view, showing favorited rounds

---

### Feature 2: Locked Rounds in Recent Rounds Section

Currently, locked rounds only appear in the "Completed Rounds" section. Change the logic so locked rounds that are among the 3 most recent rounds (by start time) also appear in the "Recent Rounds" section.

**File: `src/components/RoundHistory.tsx`**

Update the filtering logic:

```typescript
// Take the 3 most recent rounds regardless of status
const allSorted = [...roundHistory].sort((a, b) => b.startTime - a.startTime);
const recentIds = new Set(allSorted.slice(0, 3).map(r => r.id));

// Recent = ACTIVE, COMPLETE, or any round in the top 3 most recent
const recentRounds = roundHistory.filter(r => 
  r.status === 'ACTIVE' || r.status === 'COMPLETE' || recentIds.has(r.id)
);

// Completed = LOCKED rounds that are NOT in the recent section
const completedRounds = roundHistory.filter(r => 
  r.status === 'LOCKED' && !recentIds.has(r.id)
);
```

This ensures locked rounds still appear in the "Recent" area if they were one of the last 3 rounds played.

---

### Feature 3: Bogey and Double-Bogey Outline Styling

Change the scorecard so bogey scores have a dark **outlined** square (no filled background) and double-bogey+ scores have a **double outlined** square.

**File: `src/components/Scorecard.tsx`** (on-screen scorecard, lines ~960-983)

Update the score cell rendering for bogey and double-bogey:

- **Bogey (diff === 1):** Remove the background fill. Apply `border-2 border-foreground` (dark outline) with `rounded-lg` shape. Text stays the destructive/red color.
- **Double bogey+ (diff >= 2):** Apply `ring-2 ring-foreground ring-offset-1 border-2 border-foreground` (double outline effect using border + ring) with `rounded-lg` shape. Text stays the destructive/red color.
- **Under par (birdies/eagles):** Keep existing circle shape with filled background (no change).
- **Par:** Keep as-is with no shape (no change).

The visual effect:

```
Birdie:  Filled green circle
Eagle:   Filled gold circle with ring
Par:     Plain number, no shape
Bogey:   Single dark outlined square
Dbl Bogey: Double dark outlined square
```

**File: `src/components/Scorecard.tsx`** (hidden image capture container, lines ~1388-1403)

Apply the same outline logic using inline styles for the share image:

- **Bogey:** `border: '2px solid #1e2530'`, `borderRadius: '8px'`, no background fill
- **Double bogey+:** `border: '2px solid #1e2530'`, `outline: '2px solid #1e2530'`, `outlineOffset: '2px'`, `borderRadius: '8px'`, no background fill

---

## Files Changed Summary

| File | Changes |
|------|---------|
| Database migration | Add `is_favorite` boolean column to `rounds` table |
| `src/types.ts` | Add `isFavorite` field to `Round` interface |
| `src/hooks/useRounds.tsx` | Map `is_favorite`, add `toggleRoundFavorite` function |
| `src/contexts/AppContext.tsx` | Add `toggleRoundFavorite` to `AppState` interface |
| `src/App.tsx` | Wire `toggleRoundFavorite` through context |
| `src/components/RoundHistory.tsx` | Add favorite toggle button on cards, "Favorites" section, update recent rounds logic to include locked rounds within the last 3 |
| `src/components/Scorecard.tsx` | Update bogey to outlined square, double bogey to double-outlined square (both on-screen and share image) |

