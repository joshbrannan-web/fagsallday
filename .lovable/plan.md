

## Incomplete Round Actions on Summary Page

Add conditional buttons and logic to the Round Summary page based on whether all 18 holes have been scored.

### What Changes

- When the round is **not fully complete** (not all holes scored for all players), two new buttons appear below "View Scorecard":
  - **Return to Hole** -- navigates back to `/active` so the user can continue scoring
  - **Delete Round** -- deletes the current round and navigates home
- The **Finish & Save** button only appears when all 18 holes have been completed (every player has a non-null score for all holes)
- The header will say "Round Summary" instead of "Round Complete" when holes are still missing

### How Completeness Is Determined

A round is considered fully complete when every hole (1-18) has a non-null score for every player. This is checked by iterating through `currentRound.scores` for holes 1-18 and verifying each player has a numeric score.

### Technical Details

**File: `src/components/RoundSummary.tsx`**

1. Add a computed boolean `allHolesComplete`:
   ```
   Check holes 1-18, for each hole verify every player
   has a non-null score in currentRound.scores[hole][playerId]
   ```

2. Add a `handleDeleteRound` function that calls `deleteRound(currentRound.id)`, then `clearLoadedRound()`, then navigates to `/`

3. Update the header text: show "Round Summary" when `!allHolesComplete`, "Round Complete" when complete

4. In the bottom button area (lines 449-481), after the "View Scorecard" button:
   - If `!allHolesComplete` and round status is `ACTIVE`: show "Return to Hole" button (navigates to `/active`) and "Delete Round" button (destructive variant, calls `handleDeleteRound`)
   - Change the existing "Finish & Save" condition from `currentRound.status === 'ACTIVE'` to `currentRound.status === 'ACTIVE' && allHolesComplete`

5. Import `Trash2, ArrowLeft` from lucide-react for the new button icons

No other files need changes -- `deleteRound` and `clearLoadedRound` already exist in AppContext.
