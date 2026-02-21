## UX Improvements Plan

### 1. First-Time User Onboarding

**What**: Show a brief welcome overlay/tutorial the first time a signed-in user visits the app, explaining the core flow and game types.

**Implementation**:

- Create a new `src/components/OnboardingOverlay.tsx` component
- Uses a Dialog/Sheet with 3-4 swipeable steps:
  1. "Welcome to F&Gs All Day" -- brief intro
  2. "Pick a Course" -- explains course search, camera scan, and saved courses
  3. "Choose Your Games" -- shows the game types with icons and 1-line descriptions (Banker, Skins, FBO, 6's, Wolf, etc.) so users understand what each one does before they see the full list
  4. "Track & Settle" -- explains scoring, auto-calculations, and payout summaries
- Track whether onboarding has been shown via `localStorage` key (`fg_onboarding_complete`)
- Show automatically on first visit to Landing when signed in; include a "Skip" button and a dot-based step indicator
- Add a "How it works" link in the Landing page user dropdown to re-trigger the overlay

**Files**:

- New: `src/components/OnboardingOverlay.tsx`
- Edit: `src/components/Landing.tsx` -- render `<OnboardingOverlay />` conditionally; add "How it works" menu item

---

### 2. Setup Wizard Improvements

**What**: Make the 4-step wizard less overwhelming, especially for new users, by adding contextual help and progressive disclosure.

**Implementation**:

- **Step indicator**: Add a visual progress bar at the top of the wizard showing steps 1-4 (Course, Players, Games, Review) using the existing `Progress` component
- **Game descriptions tooltip**: On the game selection step (Step 3), add an info icon next to each game that opens a small popover with a longer explanation of how the game works, ideal player count, and example payout
- **Validation messaging**: Replace generic toasts with inline validation hints (e.g., "Wolf requires exactly 4 players" shown below the game card when incompatible)

**Files**:

- Edit: `src/components/SetupWizard.tsx`
  - Add step progress bar (around line 210, the step state area)
  - Add game info popovers in the game selection rendering section
  - Add inline validation for player-count constraints

---

### 3. Round History UX

**What**: Improve the history page with better organization, search/filter, and summary info at a glance.

**Implementation**:

- **Search bar**: Add a text search input at the top to filter rounds by course name or player name
- **Stats summary**: Show a small stats card at the top: total rounds played, most-played course, lifetime net P&L
- **Better empty state CTA**: Replace "Finish a round to see it here" with a button that navigates to `/setup`
- **Delete confirmation**: Replace `window.confirm()` with the existing `AlertDialog` component for consistent styling
- **Game badges**: Show small badges on each round card indicating which games were played (e.g., "Banker", "Skins" pills)
- **Holes completed indicator**: Show "12/18 holes" for active/incomplete rounds

**Files**:

- Edit: `src/components/RoundHistory.tsx`
  - Add search input and filtering logic
  - Add stats summary section
  - Replace `window.confirm` with `AlertDialog`
  - Add game type badges and hole progress to `RoundCard`

---

### 4. Active Round Navigation

**What**: Make it easier to navigate during an active round -- quick hole jumping, home access, and a persistent status bar.

**Implementation**:

- **Hole picker grid**: Add a tappable hole grid (1-18) that appears when the user taps the "Hole X" title in the top bar, allowing direct jump to any hole. Completed holes show a checkmark, current hole is highlighted.
- **Home button**: Add a Home icon button in the top bar (next to Menu) that navigates to `/` with a confirmation dialog if the round is active ("Your round will be saved. Return anytime.")
- **Progress indicator**: Add a thin progress bar below the top nav showing how many holes have been scored (e.g., 12/18 = 67%)
- **Hole completion dots**: Below the hole navigation arrows, show 18 small dots representing each hole -- filled = scored, empty = not yet scored, current = highlighted

**Files**:

- Edit: `src/components/ActiveRound.tsx`
  - Add hole picker dropdown/popover triggered by tapping "Hole X"
  - Add Home button with confirmation dialog
  - Add progress bar using the `Progress` component
  - Add 18-dot completion indicator row

---

### Technical Notes

- All new state (onboarding completed, search filters) uses `localStorage` or component-level `useState` -- no database changes needed
- No new dependencies required; all UI uses existing shadcn/ui components (Dialog, Progress, Popover, AlertDialog, Badge)
- The `SetupWizard.tsx` file is large (~2400 lines); changes will be targeted line edits, not rewrites
- The `ActiveRound.tsx` file is similarly large (~2200 lines); the hole picker and navigation changes target the top bar area (lines 613-679)