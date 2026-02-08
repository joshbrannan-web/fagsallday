

## Auto-Verify Courses After Scorecard Scan/Upload

### Problem
Currently, when a user scans or uploads a scorecard image, the extracted course data is only stored locally in their session (and optionally saved to their personal "Saved Courses" list). To share it with the community via the Verified Course Library, they must manually click a separate Verify button. This extra step is easy to miss.

### Solution
Automatically verify (publish to the community library) the course data after a successful scorecard scan or tee box selection. Since the data comes directly from a real scorecard image, it is inherently "verified" -- the user physically has the scorecard.

### Changes

**File: `src/components/SetupWizard.tsx`**

Two places need auto-verification logic:

1. **Single tee box result (line ~512)** -- When the AI finds only one tee box and auto-selects it via `handleSelectTeeBox`, call `verifyCourse` immediately after creating the course object.

2. **Tee box selection by user (line ~523, `handleSelectTeeBox` function)** -- After the user picks a tee box from the multi-tee list, call `verifyCourse` with the resulting course object.

In both cases, the flow is:
- Build the `Course` object from the parsed tee box data (already happening)
- Call `verifyCourse(course)` in the background (fire-and-forget, no blocking)
- Update `verifiedCourseNames` state on success so the UI shows the green badge
- If the course is already verified (duplicate key error `23505`), silently succeed -- no error toast needed

The `verifyCourse` hook already handles:
- Checking if the user is authenticated (required)
- Checking if the data is "real" (not all defaults)
- Handling duplicate key errors gracefully
- Inserting into the `verified_courses` table

### Technical Details

**In `handleSelectTeeBox` (lines 523-544):**
After the course is created and set as `selectedCourse`, add a background call:

```typescript
// Auto-verify scanned courses to the community library
if (user) {
  verifyCourse(course).then(success => {
    if (success) {
      setVerifiedCourseNames(prev => new Set([...prev, course.name.toLowerCase()]));
    }
  });
}
```

This covers both code paths (single tee box auto-select at line 512 and manual tee box selection) because they both funnel through `handleSelectTeeBox`.

**In `handleSaveScannedCourse` (lines 546-576):**
After saving the course, also verify it:

```typescript
if (user) {
  verifyCourse(courseToSave).then(success => {
    if (success) {
      setVerifiedCourseNames(prev => new Set([...prev, courseToSave.name.toLowerCase()]));
    }
  });
}
```

This ensures that "Save Course for Later" from the tee-select page also triggers verification.

**Suppressing redundant toasts:**
The `verifyCourse` function currently shows `toast.success('Course verified and shared with all players!')`. Since this happens automatically alongside other toasts ("Course data extracted!" or "Course saved!"), we should either:
- Accept the double-toast (minor UX issue, but informative), OR
- Add a `silent` parameter to `verifyCourse` in the hook

The simplest approach is to accept the existing toast behavior -- it confirms to the user that the course was shared, which is positive feedback.

### What stays the same
- Manual verify buttons on Favorites, Recent, and Saved course cards remain available for courses that were NOT scanned
- The `verified_courses` table schema and RLS policies are unchanged
- Duplicate detection via the unique constraint on `lower(course_name)` prevents double entries
