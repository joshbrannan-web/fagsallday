# Easier plus-handicap entry

Phone number keypads have no "+" key, so a better-than-scratch handicap can't be typed today. Add a small toggle button beside every handicap box that flips the number between a normal handicap and a plus handicap.

## How it works

- Each handicap box gets a compact button on its left showing the current sign: `+` when the handicap is better than scratch, `–` (normal) otherwise.
- Tap the button to flip. The typed number stays the same; only the sign changes.
- The box itself keeps the plain number keypad, so entry stays fast.
- Display stays as it is today: a plus handicap shows as `+2.4` everywhere.
- Sign flips instantly, no separate save step beyond the form's existing save.

## Where it appears

- My Profile handicap
- Players list (add player and edit player)
- Tournament registration (manual handicap)
- Round setup wizard (per-player handicap)

## Technical notes

- New shared component `src/components/HandicapInput.tsx`: controlled text value plus a sign toggle, built on the existing `parseHandicapInput` / `formatHandicap` helpers in `src/lib/handicap.ts`. Value stays a display string ("2.4" / "+2.4"); parsing to the stored negative number is unchanged.
- Replace the raw handicap `Input` usages in `Profile.tsx`, `Players.tsx`, `TournamentRegistration.tsx`, and `SetupWizard.tsx` (keeping the wizard's per-player `handicapDrafts` state) with the new component.
- No storage, scoring, or GHIN changes: plus handicaps remain negative internally, and GHIN sync already applies the correct sign.
