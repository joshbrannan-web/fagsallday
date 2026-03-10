

# Consistent Team Ordering in 1v1 Sub-Matchups

## Problem
When sub-matchups are stored, `playerA` and `playerB` may not consistently correspond to Team 1 and Team 2. This means Match 1 might show Team 1 on the left while Match 2 shows Team 2 on the left, which is confusing.

## Solution
In every component that renders sub-matchups, normalize the order so the player from **Team A** (the first team / `teamAId`) is always displayed first (left), and the player from **Team B** is always second (right). This is a small normalization step applied before rendering.

## Helper
Add a reusable normalize function (inline or shared):
```typescript
const normalizeMatchup = (sm: {playerA: string; playerB: string}, teamAssignments: Record<string, string>, teamAId: string) => {
  const aIsTeamA = teamAssignments[sm.playerA] === teamAId;
  return aIsTeamA ? sm : { playerA: sm.playerB, playerB: sm.playerA };
};
```

## Files to Update (6)

### 1. `TournamentMatchStatusBar.tsx`
Before iterating `subMatchups`, normalize each entry using `teamAssignments` and `teamMatchup.teamAId`.

### 2. `TournamentScorecardTable.tsx`
In the `MatchupTable` rendering loop (~line 175), normalize each sub-matchup before passing `playerA`/`playerB`.

### 3. `TournamentFullScorecard.tsx`
In the 1v1 rendering block (~line 143), normalize each sub-matchup before looking up players.

### 4. `TournamentPlayerSummary.tsx`
Needs `teamMatchup` prop added (or just use the first team from sorted team IDs as the canonical "Team A"). Normalize sub-matchup order so Team 1 player is always on the left column.

### 5. `TournamentHoleTracker.tsx`
In the 1v1 block (~line 98), normalize each sub-matchup so Team A's player column is always first.

### 6. `GroupMatchesScoreboard.tsx`
In the sub-matchup rendering (~line 89), normalize using `gpTeamMap` and the first team in the tournament's team list (or `tm.teamAId` from the `team_matchup` JSONB).

Each change is 2-3 lines: compute normalized matchup, then use it instead of the raw `sm`.

