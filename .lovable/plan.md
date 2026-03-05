

# Plan: Disable "Not Started" Rounds in Tournament Player Wizard

## Problem
Players can currently select rounds with status `pending` ("Not Started") in Step 2 of the wizard. These rounds haven't been activated by the admin yet and shouldn't be playable.

## Fix

### `src/components/tournament/TournamentBuildRoundWizard.tsx` — `renderStep2` (lines 124-161)

Filter or disable rounds where `status === 'pending'`. The simplest approach: make the `TournamentRoundCard` unclickable for pending rounds and add a visual indicator.

In `renderStep2`, wrap the `onSelect` callback so it does nothing for pending rounds, and apply a visual disabled state:

```tsx
{setup.rounds.map(round => {
  const isPending = round.status === 'pending';
  return (
    <div key={round.id} className={isPending ? 'opacity-50' : ''}>
      <TournamentRoundCard
        round={round}
        gameType={...}
        rulesText={...}
        isSelected={setup.selectedRound?.id === round.id}
        onSelect={() => { if (!isPending) setup.selectRound(round); }}
      />
      {isPending && (
        <p className="text-xs text-muted-foreground mt-1 ml-1">
          This round hasn't been opened by the admin yet.
        </p>
      )}
      ...existing warnings...
    </div>
  );
})}
```

Also update `TournamentRoundCard` to accept an optional `disabled` prop to show `cursor-not-allowed` instead of `cursor-pointer`.

| File | Change |
|---|---|
| `src/components/tournament/TournamentBuildRoundWizard.tsx` | Skip `selectRound` for pending rounds; add opacity + helper text |
| `src/components/tournament/TournamentRoundCard.tsx` | Add optional `disabled` prop for cursor styling |

2 files changed, 0 database changes.

