

## Feature: Show Favorite Rounds in Setup Wizard Favorites Section

### What Changes

When a locked round is marked as a favorite, its course will appear in the **existing Favorites section** on Step 1 of the Setup Wizard, right alongside favorite courses. Tapping it loads that course into the new round setup.

### How It Works

1. User favorites a locked round in Past Rounds (already implemented)
2. User starts a new round and goes to the Setup Wizard
3. In the Favorites section at the top of Step 1, they see:
   - Their starred saved courses (existing behavior)
   - Their starred rounds' courses (new) -- shown with a subtle "from round" label so the user can distinguish them
4. Tapping a favorite round's course card loads the course data (name, location, holes, par, yardage) into the setup form, just like selecting a saved course

### Visual Layout

```text
--- Favorites ---
[Star] Pine Valley Golf Club         (saved course)
[Star] Bethpage Black - Jan 15, 2026 (from favorite round)
[Star] Torrey Pines - Feb 1, 2026    (from favorite round)

--- Recently Played ---
[Course cards...]

--- Recent Rounds ---
[Round cards...]
```

### Technical Details

**File: `src/components/SetupWizard.tsx`**

In the Favorites section (lines 788-824), after rendering `favoriteCourses`, add a block that:

1. Filters `roundHistory` for rounds where `isFavorite === true`
2. Deduplicates against `favoriteCourses` by course name (so the same course doesn't show twice)
3. Renders each favorite round as a tappable card with:
   - Course name
   - Date played and player count as subtitle
   - A filled star icon (matching the existing favorite course cards)
   - `onClick` calls `handleSelectSavedCourse(round.course)` then `setCourseMode("search")` to load the course details

The section header condition changes from `favoriteCourses.length > 0` to `favoriteCourses.length > 0 || favoriteRounds.length > 0` so the Favorites label appears when either type exists.

No other files need changes -- `roundHistory` and `isFavorite` are already available in the component via `useApp()`.

| File | Change |
|------|--------|
| `src/components/SetupWizard.tsx` | Add favorite rounds to the Favorites section on Step 1, tappable to load course data |

