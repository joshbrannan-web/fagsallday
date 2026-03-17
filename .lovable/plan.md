

# Read-Only Tournament Round for Non-Owner Players

## Summary
Add `isReadOnly` guard to `ActiveRound.tsx` so shared tournament rounds allow full viewing (including Tournament tab with leaderboards) but prevent all score mutations.

## Changes — Single File: `src/components/ActiveRound.tsx`

### 1. Derive `isReadOnly` flag (after line 38)
```ts
const isReadOnly = currentRound?.isShared === true;
```

### 2. Read-only banner (inside the return, after the Home Confirmation Dialog ~line 718)
When `isReadOnly`, show a sticky banner below the top bar:
```
"Viewing [ownerName]'s Round — Read Only"
```
Amber/gold background, small text, similar to the existing Scorecard read-only banner.

### 3. Disable score mutations
- **Score +/- buttons** (~lines 2212-2233): Add `disabled={isReadOnly}` and `opacity-50` styling when read-only. Wrap `onClick` handlers with `if (isReadOnly) return`.
- **`handleScoreClick`** (~line 477): Early return if `isReadOnly`.
- **`handleScoreChange`** (~line 466): Early return if `isReadOnly`.
- **Voice input button**: Hide entirely when `isReadOnly` (`{!isReadOnly && ...}`).

### 4. Disable game data mutations
- **Banker select/multiplier buttons**, **Open Betting +/- buttons**, **Team Banker multiplier buttons**, **Stockton 6 / Sixes / Team Banker team setup panels**, **FBO press buttons**: Wrap each section's render with `!isReadOnly &&` or add `disabled={isReadOnly}` where appropriate. The game status displays (FBO dots, banker info, sixes stretch summaries) remain visible.

### 5. Guard tournament score sync (~lines 341-354)
Add `isReadOnly` to the early return:
```ts
if (!tournamentGroupId || !tournamentPlayerMapping || !currentRound || isReadOnly) return;
```

### 6. Navigation adjustments
- **Next hole button** (~lines 399-418): When `isReadOnly`, skip the `canAdvanceHole()` validation — just navigate freely between holes. Remove the toast error for missing scores.
- **Hole 18 / Finish flow**: When `isReadOnly`, replace the Flag/finish button with a simple "next hole" button (or disable it at hole 18). The "Go to Summary" menu item can still work (summary is read-only already).
- **Home button**: Keep as-is (navigates home).
- **Share round link button**: Hide when `isReadOnly` (non-owner shouldn't share).

### 7. Tournament Tab — No changes needed
The Tournament tab (`TournamentTabPanel`) including leaderboards (`ScoreboardSelector` + `ScoreboardRenderer`) renders identically for all users. The `useTournamentScoreboards` hook fetches data directly from the database, not from local round state, so non-owners see the same live leaderboards.

## What stays functional for read-only users
- Hole navigation (prev/next/jump-to-hole picker)
- Betting ↔ Tournament tab toggle
- All Tournament tab content: Match Status, Players, Hole Tracker, Full Scorecard, Leaderboards
- Betting tab: View scores, P&L totals, game status (read-only)
- Bottom drawer: Round totals summary (read-only)
- Scorecard page link

## Files
| File | Change |
|---|---|
| `src/components/ActiveRound.tsx` | Add `isReadOnly` flag, read-only banner, guard all mutations, free hole navigation |

1 file modified, 0 new files, 0 database changes.

