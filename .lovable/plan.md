

# Add "Live Group Matches" Scoreboard Type

## What it does
A new scoreboard type that displays all groups in the current/active round(s) with their live team-vs-team point totals. Each row shows the group number, player names on each side, and the current score. Works for both 2v2 and 1v1 formats. Tapping a group row navigates to that group's detailed scorecard.

## Changes

### 1. `src/components/tournament-admin/ScoreboardManager.tsx`
Add new type to `SB_TYPES` array:
```ts
{ value: 'group_matches', label: 'Live Group Matches' }
```

### 2. `src/components/scoreboards/GroupMatchesScoreboard.tsx` (new file)
New component that:
- Iterates over rounds (active/completed) → groups per round
- For each group, calculates team point totals using `calcTeamTotals`
- Renders a card per round with rows showing: group number, player names per team, score vs score, live indicator if round is active
- Tapping a row navigates to `/tournament/${joinCode}/round/${roundId}/group/${groupId}`
- Reuses existing `calcTeamTotals` from `scoreboardCalculations.ts`
- Shows team colors as dot indicators

### 3. `src/components/scoreboards/ScoreboardRenderer.tsx`
Add `case 'group_matches'` that renders `<GroupMatchesScoreboard {...commonProps} />`

3 files changed (1 new), 0 database changes.

