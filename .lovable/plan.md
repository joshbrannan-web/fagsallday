

# Show 2nd Ball Tiebreaker Status on Ready to Play Page

**File: `src/components/tournament/TournamentBuildRoundWizard.tsx`** — `renderStep7()`

After the Tournament Game label (line 351), add a `(2nd Ball: On/Off)` indicator when the game type is `match_play_best_ball` or `match_play_gross_best_ball`, reading `setup.tournamentGame.second_ball_tiebreaker`.

```tsx
<p className="font-semibold text-[hsl(var(--brand-gold))]">
  {GAME_TYPE_LABELS[setup.tournamentGame.game_type] || setup.tournamentGame.game_type}
  {['match_play_best_ball', 'match_play_gross_best_ball'].includes(setup.tournamentGame.game_type) && (
    <span className="text-sm font-normal text-muted-foreground ml-1">
      (2nd Ball: {setup.tournamentGame.second_ball_tiebreaker ? 'On' : 'Off'})
    </span>
  )}
</p>
```

One line change, consistent with existing pattern noted in memory.

