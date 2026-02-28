

## Add "Decline" Button to FBO Press UI

Currently each press option is a single toggle button (Press / Pressed). The plan is to split each into two side-by-side buttons: **Press** and **Decline**.

### Behavior

- **Press**: Works exactly as today — activates the press bet.
- **Decline**: Dismisses the press prompt for that player/segment for the current hole. The card disappears (or that row disappears) so it stops nagging the user. Stored in component state (not persisted) so it reappears if the user navigates away and comes back — keeping it lightweight.
- Once pressed or declined, the button pair is replaced with either the green "Pressed" indicator or a muted "Declined" label.
- "Press Both" remains as a convenience shortcut. A "Decline All" button will also be added next to it when both segments are available.

### Implementation

**1. Add declined state tracking** (`src/components/ActiveRound.tsx`)

Add a `useState<Set<string>>` called `declinedPresses`. Keys will be composite strings like `${gameId}-${playerId}-${segment}` (pool mode) or `${gameId}-${dormiePlayerId}-${opponentId}-${segment}` (H2H mode).

**2. Update H2H press buttons** (lines ~1491-1556)

For each segment button, replace the single toggle button with a two-button row:
- Left button: "Press F9/B9/Overall" (amber/primary, same as today)
- Right button: "Decline" (outline/muted style)
- If declined, show a muted "Declined F9" label instead of both buttons
- If pressed, show the green "Pressed F9" label (same as today)
- Update "Press Both" to also have a "Decline All" sibling

**3. Update All Together (pool) press buttons** (lines ~1629-1696)

Same pattern: split each single button into Press + Decline pair.

**4. Reset declined state on hole change**

Add a `useEffect` that clears `declinedPresses` when `activeHole` changes, so the prompt reappears on the next hole if still eligible.

### Files modified
- `src/components/ActiveRound.tsx` — all changes in one file

