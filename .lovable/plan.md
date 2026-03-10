

# Add Cumulative Scoring Callout to Course & Game Confirmation Step

## Change

**`src/components/tournament/TournamentBuildRoundWizard.tsx`** — In `renderStep3` (the "Confirm Course & Game" step), add a callout when the tournament uses cumulative scoring (`setup.tournament.team_scoring_method === 'cumulative'`).

After the existing rules/points info (line ~227), insert an `Alert` or styled info box:

```
Every hole counts! Each hole is worth points towards your team's overall total. Keep playing all 18 holes — no concessions.
```

Use the existing `Alert` component or a simple styled div with an info icon. Only show this when `team_scoring_method` is `'cumulative'`.

**1 file, ~8 lines added.**

