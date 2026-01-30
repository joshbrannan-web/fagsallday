
## ✅ COMPLETED: Press Button Toggle UI + Scorecard Bogey Square Styling

### Changes Made

**1. Press Button Toggle (ActiveRound.tsx)**
- Added `handleFBOUnpress` function to remove/undo presses
- Added `getH2HPressExists` helper for H2H mode
- Added `getPoolPressExists` helper for pool mode
- Updated H2H press buttons: amber → green with checkmark when pressed, click again to undo
- Updated "All Together" press buttons: same toggle behavior
- "Press Both" button only shows when neither segment nor overall is pressed

**2. Scorecard Score Shapes (Scorecard.tsx)**
- Birdies/Eagles: Circle (`rounded-full`)
- Bogeys/Double+: Square (`rounded-lg`)
- Par: No shape (just text)

### Visual Summary

| State | Color | Icon | Text |
|-------|-------|------|------|
| Not pressed | Amber | None | "Press F9" |
| Pressed | Green (success) | ✓ Checkmark | "Pressed F9" |

| Score | Shape |
|-------|-------|
| Eagle (-2) | Circle |
| Birdie (-1) | Circle |
| Par (0) | None |
| Bogey (+1) | Square |
| Double+ (+2) | Square |
