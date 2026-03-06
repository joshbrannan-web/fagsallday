

# Fix: Tournament Scorecard Table — Text Wrapping on Mobile

## Problem
The previous plan only increased min-widths and padding but did **not** address text wrapping. The current code uses `truncate max-w-[70px]` on player names (line 131), which clips names with ellipsis. On mobile portrait, names get cut off rather than wrapping.

## Updated Approach
Instead of truncating, allow player names to **wrap** naturally. The player column is already `sticky left-0` with a horizontal scroll for hole columns, so wrapping the name won't break the table layout.

## Changes — `src/components/tournament/TournamentScorecardTable.tsx`

1. **Player name cell (line 131)**: Remove `truncate max-w-[70px]`, add `whitespace-normal break-words` so names wrap on narrow screens
2. **Player column header (line 105)**: Increase `min-w-[90px]` to `min-w-[100px]` for a bit more breathing room
3. **Hole columns (line 107)**: Increase `min-w-[36px]` to `min-w-[40px]` for better touch targets
4. **Score cells (line 134+)**: Increase cell padding from `p-1` to `p-1.5` for readability
5. **Result row label (line ~171)**: Match updated padding

This ensures on mobile portrait: names like "Christopher M." wrap to two lines rather than being truncated or shrunk.

1 file, ~5 line-level changes.

