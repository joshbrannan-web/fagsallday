

## Add "Activate Bloody Banker" Prompt to Regular Banker Games at Hole 16

### Summary
When a user is playing a regular Banker game and reaches hole 16, a popup dialog will ask if they want to activate Bloody Banker rules for holes 16, 17, and 18. If they decline, the game continues as normal Banker. If they accept, the full Bloody Banker mechanics (down-the-most player sets stakes, custom per-player stakes) kick in for the remaining three holes.

### How It Works

1. **Hole 16 Popup**: When the user navigates to hole 16 during a regular Banker game, an AlertDialog appears asking "Activate Bloody Banker Rules?" with YES and NO buttons.

2. **Choice is stored**: The user's choice is persisted in `gameData` under a `_META_BLOODY_ACTIVATED` flag for that Banker game. This ensures the choice is remembered if the user navigates away and comes back.

3. **If YES**: Holes 16-18 get the full Bloody Banker experience -- the "down the most" player UI appears, custom per-player stakes are available, and the game engine uses custom stake calculations for those holes.

4. **If NO**: The game continues as a standard Banker with no changes.

### Technical Changes

**File: `src/components/ActiveRound.tsx`**
- Add state for showing the Bloody Banker activation dialog
- Add a `useEffect` that triggers the dialog when the user reaches hole 16 on a regular Banker game (GameType.BANKER) and hasn't already made a choice
- Store the user's choice via `updateGameData(gameId, 0, '_META_BLOODY_ACTIVATED', true/false)` (hole 0 as a game-level metadata slot)
- Extend the `bloodyBankerDownPlayer` useMemo to also include regular Banker games that have `_META_BLOODY_ACTIVATED === true`
- Extend the Bloody Banker UI section to also render for activated Banker games on holes 16-18
- Add an AlertDialog with "Activate Bloody Banker?" messaging

**File: `src/services/gameEngine.ts`**
- In both `calculateBanker` and `calculateAggregatedHolePnL`, update the Bloody Banker custom stake checks to also apply when a Banker game has `_META_BLOODY_ACTIVATED === true` in its gameData
- Change condition from `game.type === GameType.BLOODY_BANKER && h >= 16` to `(game.type === GameType.BLOODY_BANKER || gameData?.[game.id]?.[0]?.['_META_BLOODY_ACTIVATED']) && h >= 16`

**File: `src/components/AdminActiveRound.tsx`**
- Same extension to include activated Banker games in the admin view's bloody banker logic

### No Changes Needed
- Types (no new types required, uses existing gameData structure)
- SetupWizard (Bloody Banker remains a separate game choice for users who want it from hole 1)
- RoundSummary / Scorecard (they already handle custom stakes dynamically)

