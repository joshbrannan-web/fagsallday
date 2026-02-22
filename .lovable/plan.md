

## Add Save and Verify Buttons After Scorecard Scan

### Problem
After a user scans a scorecard, selects a tee box, and updates the course name/location, they land on the "search" mode view showing course details. This view has no buttons to save the course for later or verify it for the community.

### What Changes

**File: `src/components/SetupWizard.tsx`**

Add a row of action buttons in the search mode view, below the "Course data loaded!" confirmation box (around line 1281). These buttons appear when a `selectedCourse` exists:

1. **Save Course for Later** button -- calls `saveCourse(selectedCourse)` to add it to the user's saved courses list. Shows a checkmark if the course is already saved.

2. **Verify for Community** button -- calls `handleVerifyCourse(selectedCourse)` to publish the scorecard data to the verified courses library for all users. Only shows if:
   - The user is signed in
   - The course is not already verified (checked via `verifiedCourseNames`)

Both buttons will use the updated course name and location from the input fields (not just the original scanned values), so the course object is rebuilt with the current `courseName` and `courseLocation` before saving/verifying.

### Technical Details

- Before saving or verifying, rebuild the course object with current `courseName`/`courseLocation` values so edits are captured
- The save button uses `saveCourse()` from the `useApp` context (already available)
- The verify button uses `handleVerifyCourse()` (already defined at line 413)
- Add a `courseSaved` local state flag to show visual feedback after saving
- The verify button is hidden when the course name is already in `verifiedCourseNames`
- Both buttons sit in a flex row between the "Course data loaded!" box and the "Edit Hole Details" toggle
