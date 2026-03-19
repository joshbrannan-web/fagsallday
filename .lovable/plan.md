

# Round Complete Dashboard for Tournament Admin

## Overview
Create a new "Results" tab on the existing Tournament Admin Dashboard that displays completed round data: scores, points, team totals, and winning/losing teams — all in a clean, mobile-friendly layout.

## Approach
Rather than a separate page, add a 5th tab ("Results") to the existing `TournamentAdminDashboard.tsx` Tabs component. This tab fetches `tournament_hole_scores` and `tournament_hole_results` for completed rounds and uses existing `scoreboardCalculations.ts` helpers to compute totals.

## Changes

### 1. New: `src/components/tournament-admin/RoundResultsDashboard.tsx`
A self-contained component that receives tournament data props and renders:

- **Round-by-round accordion** — each completed round expands to show:
  - Game type, course, date
  - **Team Scoreboard** — team totals for the round with color indicators, winner highlighted with a trophy icon
  - **Player Leaderboard** — table of all players in that round showing: name, team (color dot), gross score, net score, points earned, sorted by points desc
  - **Group Breakdown** — collapsible per-group sections showing hole-by-hole results

- **Tournament Grand Totals** card at the top:
  - Team standings across all completed rounds with cumulative points
  - Visual bar or progress indicator showing relative team positions
  - "Leading" / "Trailing" labels

- Data fetching: on mount, queries `tournament_hole_scores` and `tournament_hole_results` for all groups in completed rounds. Uses `calcTeamTotals`, `calcTeamTotalsPerRound`, `calcPlayerGrossPerRound`, `calcPlayerNetPerRound`, `calcPlayerPointsPerRound` from `scoreboardCalculations.ts`.

### 2. `src/pages/TournamentAdminDashboard.tsx`
- Add "Results" as a 5th tab in the TabsList (change `grid-cols-4` to `grid-cols-5`)
- Add `<TabsContent value="results">` rendering `<RoundResultsDashboard>` with the existing state props (tournament, teams, players, rounds, games, groups, groupPlayers)

### 3. No database changes needed
All data already exists in `tournament_hole_scores`, `tournament_hole_results`, `tournament_groups`, etc. The existing RLS policies allow the tournament creator to read all this data.

## Technical Detail

```text
TournamentAdminDashboard
  └── Tabs: Overview | Rounds | Players | Teams | Results
                                                    │
                                          RoundResultsDashboard
                                            ├── Grand Totals Card (cumulative team points)
                                            └── Per completed round:
                                                 ├── Team Results (winner/loser + points)
                                                 ├── Player Table (gross, net, points)
                                                 └── Group Details (expandable)
```

Data flow:
- Component fetches `tournament_hole_scores` and `tournament_hole_results` via Supabase
- Filters to groups belonging to completed rounds only
- Uses `scoreboardCalculations.ts` pure functions for all math
- No new database tables, functions, or RLS policies required

| File | Change |
|---|---|
| `src/components/tournament-admin/RoundResultsDashboard.tsx` | New — full results dashboard component |
| `src/pages/TournamentAdminDashboard.tsx` | Add Results tab |

2 files (1 new), 0 database changes.

