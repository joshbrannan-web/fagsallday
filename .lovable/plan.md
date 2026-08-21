# Highlight counting balls by net score, not gross

On the round scorecard, the cells that get outlined/tinted as "counting toward the team score" are currently picked by lowest **gross** score. The engine decides holes on **net**, so the highlight can land on the wrong player — e.g. hole 1, Josh Brannan (net 5) is highlighted instead of Jeff Sahid (net 4).

## Change

In `src/components/tournament-admin/TestScorecardSection.tsx`, the best-ball selection helper (`countingIds`) sorts team members by gross. Change it to sort by net (`gross - strokesFor(playerId, hole)`) when handicaps are in play, falling back to gross when they are not, then take the best N balls as today.

Everything downstream already reads from this helper:
- outlined counting cells
- winner tint
- team net footer rows

so they all become consistent with the engine's net comparison after this one fix. Ties on net keep the current stable behavior (lower gross first).

## Scope

Display-only, one file. No engine, data, or scoring changes.
