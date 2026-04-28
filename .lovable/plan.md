## Adjust LR Hammer team selection timing

Currently, when an LR Hammer hole opens, the app immediately auto-pops the team-selection dialog (because `teams` is missing). The user wanted to pick teams up-front, before the hole. Now they want it the other way: defer team picking until they're entering scores for that hole.

### Behavior change

**LR Hammer only** (Team Hammer segments stay as-is — those are still set at segment start):

1. Do NOT auto-open the team-setup dialog when a new LR hole becomes active.
2. Show a compact "Hammer · Hole N" placeholder card with:
   - Pot preview ($base)
   - Note: "Teams will be set when scores are entered"
   - A manual "Set teams now" button (in case the user wants to set them before scoring — keeps the hammer-throw mechanic available pre-shot).
3. Keep the throw buttons hidden until teams exist (already gated by `teams &&` wrapper — confirm).
4. When the user enters scores for the hole and advances (Next Hole / Save Hole in `ActiveRound`), if the LR Hammer game has no teams set for that hole, prompt the team-selection dialog at that point. Saving teams then triggers the hammer payout calc.

### Technical changes

**`src/components/hammer/HammerStatusBar.tsx`**
- Remove the auto-open `useEffect` for LR variant (keep it for Team Hammer's segment start so segment teams are still required up-front).
- Render a placeholder card when `!teams && variant === 'lr'` with pot, info text, and a "Set teams now" button that opens the existing setup dialog.
- Expose a way for the parent (`ActiveRound`) to trigger the dialog from outside — add an imperative prompt by lifting `setupOpen` control via a new prop `forcePromptTeams?: boolean` + `onPromptHandled?: () => void`, OR simpler: export a small helper `hasHammerTeamsForHole(round, gameId, hole)` and have `ActiveRound` open a confirmation/route the user back to set teams.

**Recommended simpler approach:**
- Add `hasLRHammerTeamsSet(round, game, hole)` helper in `hammerEngine.ts`.
- In `ActiveRound.tsx` (advance-hole / finish-hole handler), after existing score validation, check each active LR Hammer game. If teams are missing for the just-completed hole, block advancement with a toast/inline message: "Set Hammer teams for Hole N before advancing" and scroll to the Hammer card. The card's "Set teams now" button is now prominent (since pot/scores are visible).
- Keep `setupOpen` auto-open only for Team Hammer at the first hole of a segment.

### Files to modify

- `src/components/hammer/HammerStatusBar.tsx` — gate auto-open to Team variant only; add LR placeholder card with manual button.
- `src/services/hammerEngine.ts` — add `hasLRHammerTeamsSet` helper.
- `src/components/ActiveRound.tsx` — block advance until LR Hammer teams are set for the completed hole; surface a clear toast.

### Out of scope

- Team Hammer (segment teams continue to be selected at the start of each segment).
- Read-only / shared / admin views (no behavior change beyond what flows from the gating).
