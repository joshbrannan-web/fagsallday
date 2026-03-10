

# Separate 1v1 Sub-Matchup Results (No Combined View)

## Problem
When a 1v1 game is played (e.g., Match Play Individual with 4 players), results are still combined into a single "Team A vs Team B" aggregate. The user wants each sub-matchup shown as its own independent match — "Match 1: Josh vs Mike" and "Match 2: Kyle vs Dan" — with their own separate scores, results, and status. No combined team totals.

## Changes (4 components)

### 1. `TournamentMatchStatusBar.tsx`
When `subMatchups` exist, **replace** the combined team score display with individual match cards. Each match shows:
- Player A vs Player B with their team colors
- Individual match score (e.g., "3 — 2")
- Individual status line ("Josh 1 UP · Thru 5")
- Remove the combined "Team A 5 — Team B 3" header entirely for 1v1

### 2. `TournamentScorecardTable.tsx`
When `subMatchups` exist, render **separate scorecard tables per matchup** instead of one combined table. Each table shows:
- Only the 2 players in that matchup
- Result row based on `playerPoints` (not combined `teamPoints`)
- Individual match status and point totals
- "Match 1" / "Match 2" headers

### 3. `TournamentFullScorecard.tsx`
When `subMatchups` exist, render **separate table sections per matchup** with independent result/points rows per match. Each section has its own result indicators based on `playerPoints` and its own point totals footer. Remove the combined team totals footer.

### 4. `GroupMatchesScoreboard.tsx`
When `subMatchups` exist, render each sub-matchup as a **separate expandable row** (like separate groups) rather than one combined group row with sub-lines underneath. Each row shows player names, individual match score, status, and its own expandable hole-by-hole detail using per-player scores.

## Data Source
All per-matchup points come from `playerPoints` in `holeResults` (already computed by the engine). Per-matchup totals = sum of `playerPoints[playerA]` vs `playerPoints[playerB]` across all holes.

## Fallback
When `subMatchups` is undefined (2-player groups, non-1v1 games), all components render exactly as today — no behavior change.

