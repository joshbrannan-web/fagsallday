

# Fix: Show Full Team Name in Hole-by-Hole Headers

## Problem
When team names start with "Team" (e.g. "Team Brannan", "Team Berry"), the `split(" ")[0]` logic extracts only the word "Team" -- making both column headers show the identical, meaningless label "TEAM".

This affects three locations:
1. **`TournamentHoleTracker.tsx`** — "My Game" tab, default 2v2 team view (lines 228-232)
2. **`TournamentHoleTracker.tsx`** — 1v1 sub-matchup view already uses player first names (OK as-is)
3. **`GroupMatchesScoreboard.tsx`** — Leaderboards tab, expanded hole-by-hole in combined team view (lines 397-401)

The 1v1 sub-matchup views in both files use player names, which are fine. Only the team-header columns are affected.

## Fix
In both files, replace `name.split(" ")[0]` with the full team name for the column headers. The columns are flexible (`1fr`) so full names fit fine.

**`src/components/tournament/TournamentHoleTracker.tsx`** (lines 229, 231):
- Change `{teamA?.name.split(" ")[0]}` to `{teamA?.name}`
- Change `{teamB?.name.split(" ")[0]}` to `{teamB?.name}`

**`src/components/scoreboards/GroupMatchesScoreboard.tsx`** (lines 398, 401):
- Change `{teamA.name.split(' ')[0]}` to `{teamA.name}`
- Change `{teamB.name.split(' ')[0]}` to `{teamB.name}`

Four single-line changes total across two files.

