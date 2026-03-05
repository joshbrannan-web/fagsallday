

## Fix: Resume Round Should Open Betting Tab

The "Resume Round" button on the home screen (line 197 of `Landing.tsx`) passes tournament metadata but no `preferredTab`, so `ActiveRound` defaults to the `'tournament'` tab.

### Change

**`src/components/Landing.tsx`** (line 197): Add `preferredTab: 'betting'` to the navigation state object, matching the pattern already used by Scorecard and RoundSummary:

```tsx
navigate('/active', meta ? { state: { tournamentGroupId: meta.tournamentGroupId, tournamentName: meta.tournamentName, tournamentRoundName: meta.roundName, playerMapping: meta.playerMapping, teamMatchup: meta.teamMatchup, preferredTab: 'betting' } } : undefined);
```

1 file, 1 line changed.

