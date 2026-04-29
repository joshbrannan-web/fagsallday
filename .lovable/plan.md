# Fix: Hammer throws not registering

## Problem

In `HammerStatusBar.tsx`, both "A throws" and "B throws" buttons silently stop working as soon as scores are entered that give one team a lower net ball. The cause:

```ts
const result = calculateHammerHole(round, game, activeHole);
const settled = result?.winningTeam !== undefined && result?.winningTeam !== null;
...
if (isReadOnly || settled) return;
```

`calculateHammerHole` returns a `winningTeam` the moment all required players have a score and one side has a lower ball. `settled` then flips true, disables the throw handler, and (because the buttons are not visually disabled by `settled`, only by `lastThrownBy`) clicks appear to do nothing — exactly the symptom the user reported.

This contradicts Hammer rules: a team can throw the hammer at any point during the hole (before/during/after putts), until the group moves to the next hole. The "settled" concept here is a UI artifact, not a real game state — there is no separate "lock hole" action for Hammer.

A secondary risk: `handleThrow` reads `hammerCount` from a closure. Two rapid clicks could write the same `hammerCount + 1`. We will use a functional update pattern (read latest from `round.gameData` at click time via the engine helper) to avoid lost increments.

## Changes

**`src/components/hammer/HammerStatusBar.tsx`**

1. Remove the `settled` gate from `handleThrow`. Throws stay allowed for the active hole regardless of score state. Only `isReadOnly` and the turn rule (`lastThrownBy === side`) block a throw.
2. Re-read the latest `hammerCount` from `getHammerHoleState(round.gameData, game.id, activeHole)` inside `handleThrow` immediately before computing the new value, so fast double-clicks can't reuse a stale count.
3. Keep the visual "Pot" display, results card, and turn-button disabling unchanged.

No other files need changes. The engine still computes `winningTeam` correctly using the final `hammerCount` from `gameData` at calculation time.

## Acceptance

- Enter scores on a hammer hole where Team A is lower → "B throws" still works and doubles the pot.
- Click "A throws" twice rapidly → pot doubles exactly once (turn rule blocks the second), no lost increments on legitimate alternating throws.
- Read-only / shared rounds still cannot throw.
