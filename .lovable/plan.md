

## Add Verify Button to Favorite Round Cards

### Problem
The Favorites section shows two types of cards:
1. **Saved favorite courses** -- these already have the Verify/Verified badge (working correctly)
2. **Favorite rounds** (deduplicated) -- these are missing the Verify button and Verified badge

### Change

**File: `src/components/SetupWizard.tsx` (lines 905-924)**

Update the favorite round cards to match the saved course card pattern:

- Change the outer element from a single `<button>` to a `<div>` container (same as saved course cards)
- Wrap the course-select click handler in an inner `<button>` for the text area
- Add a "Verified" badge next to the course name when the course is already in the verified library
- Add the ShieldCheck verify button (same as saved courses) when the course is NOT yet verified and user is logged in
- Keep the existing Star icon

The result is that favorite round cards will look and behave identically to saved favorite course cards regarding verification.

### Technical Details

The favorite rounds section at lines 905-924 will be restructured from:

```
<button (whole card clickable)>
  <div (course info)/>
  <Star icon/>
</button>
```

To:

```
<div (container)>
  <button (course info - clickable to select)>
    <name + Verified badge if applicable/>
    <date info/>
  </button>
  <ShieldCheck button (if not verified and user logged in)/>
  <Star icon/>
</div>
```

This mirrors the exact pattern already used for saved favorite courses at lines 862-903. No new dependencies, hooks, or database changes are needed -- it reuses the existing `verifiedCourseNames`, `handleVerifyCourse`, and `isVerifying` variables already in scope.
