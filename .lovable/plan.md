

# Add Defensive Team Banker Mode Coercion in GameSelector

## What
Add a `handleGamesChange` wrapper around `onGamesChange` that coerces Team Banker to `'eighteen'` mode whenever `isTournamentMode` is true, then replace all internal `onGamesChange(...)` calls with `handleGamesChange(...)`.

## Changes — `src/components/GameSelector.tsx`

1. **Add wrapper function** after line 23 (before `handleToggleGame`):
```ts
const handleGamesChange = (games: GameSettings[]) => {
  if (isTournamentMode) {
    const sanitized = games.map(g =>
      g.type === GameType.TEAM_BANKER
        ? { ...g, config: { ...g.config, teamBanker: { ...g.config.teamBanker, mode: 'eighteen' } } }
        : g
    );
    onGamesChange(sanitized);
  } else {
    onGamesChange(games);
  }
};
```

2. **Replace all 5 `onGamesChange(...)` calls** inside the component body (lines 27, 41, 55, 59, 65) with `handleGamesChange(...)`. This covers:
   - `handleToggleGame` (remove game / add game)
   - `handleUpdateGameStake`
   - `handleUpdateGameConfig`
   - `updateGameConfigDeep`

3. **Remove** the now-redundant tournament mode check on lines 38-40 (the wrapper handles it).

