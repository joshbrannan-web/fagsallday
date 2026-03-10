

# Show 1v1 Sub-Matchups in Tournament Mode UI

## Problem
When a 1v1 game type (Match Play Individual, Alternate Shot Twosomes, Scramble 2) is played with 4 players in a group, the scoring engine correctly splits into two sub-matchups and merges results. However, the UI everywhere displays the match as a generic "Team A vs Team B" 2v2, making it impossible to see:
- Which player is matched against which player
- How each individual matchup is contributing points to the team total

## Root Cause
The `subMatchups` data (stored in `team_matchup` JSONB) is loaded by `useTournamentOverlay` but **never returned** to consuming components. All UI components only receive `teamMatchup` (Team A vs Team B) and display team-level aggregates.

## Helper Function
Create a utility to detect if the current game has sub-matchups:
```typescript
const is1v1WithSubMatchups = (gameType: string, subMatchups?: {playerA:string;playerB:string}[]) =>
  subMatchups && subMatchups.length > 0 && ['match_play_individual','alternate_shot_twosomes','scramble_2'].includes(gameType);
```

## Changes (8 files)

### 1. `src/hooks/useTournamentOverlay.ts`
**Return `subMatchups` from the hook** — add it to the return object (line ~442).

### 2. `src/components/tournament/TournamentTabPanel.tsx`
**Add `subMatchups` prop** and pass it through to child components: `TournamentMatchStatusBar`, `TournamentPlayerSummary`, `TournamentHoleTracker`, `TournamentFullScorecard`.

### 3. `src/components/ActiveRound.tsx` + `src/pages/TournamentAdminLiveView.tsx`
**Pass `subMatchups`** from overlay to `TournamentTabPanel`.

### 4. `src/components/tournament/TournamentPlayerSummary.tsx`
When `subMatchups` exist, instead of grouping by team, show **matchup pairs**:
```
┌─ Match 1 ──────────────────┐
│ 🔴 Josh    vs   Mike 🔵   │
│ G:38 N:36 Pts:3   G:40... │
├─ Match 2 ──────────────────┤
│ 🔴 Kyle    vs   Dan  🔵   │
│ G:37 N:35 Pts:2   G:39... │
└────────────────────────────┘
```
Each matchup shows both players side-by-side with their individual stats and who they're playing against.

### 5. `src/components/tournament/TournamentHoleTracker.tsx`
When `subMatchups` exist, show **per-player scores** in each matchup row instead of team-best scores. The result column will show individual match labels (parsed from the concatenated `resultLabel` field using `·` delimiter) so each row has two result indicators. Column headers show player first names instead of team names.

### 6. `src/components/tournament/TournamentMatchStatusBar.tsx`
When `subMatchups` exist, show **individual match status lines** below the team total:
```
Match 1: Josh vs Mike — Josh 2 UP thru 5
Match 2: Kyle vs Dan  — All Square thru 5
```
This uses per-player points from `playerPoints` in `holeResults` to compute each matchup's running score.

### 7. `src/components/tournament/TournamentFullScorecard.tsx`
When `subMatchups` exist, visually **group players by matchup** (Match 1 separator, then the two players, Match 2 separator, then the next two). The Result row shows per-matchup win indicators (two dots per hole for the two matches).

### 8. `src/components/scoreboards/GroupMatchesScoreboard.tsx`
When the game type is a 1v1 format and `subMatchups` exist in the group's `team_matchup` JSONB, show **individual matchup rows** within each group card:
```
G1  Josh vs Mike     🔴 2 - 1 🔵
    Kyle vs Dan      🔴 1 - 2 🔵
                     ─────────────
    Team Total       🔴 3 - 3 🔵
```
Sub-matchup points are derived from `player_points` in `tournament_hole_results`. The `team_matchup` JSONB (which contains `subMatchups`) is already fetched and available.

### 9. `src/components/Scorecard.tsx` + `src/components/tournament/TournamentScorecardTable.tsx`
Pass `subMatchups` to `TournamentScorecardTable`. When present, group players by matchup and show per-match result indicators in the Result row.

## Data Flow
```text
team_matchup JSONB { teamAId, teamBId, subMatchups: [{playerA, playerB}] }
     │
     ▼
useTournamentOverlay → returns subMatchups
     │
     ▼
TournamentTabPanel → passes to all child components
     │
     ├─► MatchStatusBar (per-match status lines)
     ├─► PlayerSummary (matchup pair layout)
     ├─► HoleTracker (per-player scores, per-match results)
     ├─► FullScorecard (matchup groupings)
     └─► ScorecardTable (matchup groupings)

GroupMatchesScoreboard → reads subMatchups from team_matchup JSONB directly
```

## Key Design Decisions
- **No engine changes** — the engine already handles subMatchups correctly; this is purely a UI presentation fix
- **Graceful fallback** — if `subMatchups` is undefined (2-player groups or non-1v1 games), all components render exactly as they do today
- **Per-match points** are derived from `playerPoints` in hole results (already computed by the engine) rather than requiring new engine output

