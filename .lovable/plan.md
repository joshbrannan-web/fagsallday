

# Show Team Scoring Method on Tournament Dashboard Overview

## Change

**`src/pages/TournamentAdminDashboard.tsx`** — In the Overview tab, add a line below the Join Code card showing the team scoring method. Display it as a small info row like:

```
Scoring: Cumulative Points (every hole)
```
or
```
Scoring: Round Win (1pt per round)
```

This uses the existing `tournament.team_scoring_method` field already loaded via `useTournamentDetail`.

### Implementation
- Add a new row inside or just below the Join Code card (lines ~290-298) showing a `Trophy` or similar icon + the scoring method label
- Map `'cumulative'` → `"Cumulative Points — every hole counts"` and `'round_win'` → `"Round Win — 1pt per round win, ½pt tie"`

**1 file, ~5 lines added.**

