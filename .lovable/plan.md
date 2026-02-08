

## Allow Editing Course Name on "Select Tee Box" Page

### Problem
When a user scans a scorecard and reaches the "Select Tee Box" page, the course name is displayed as static, non-editable text. If the AI fails to extract the course name (or extracts it incorrectly), clicking "Save Course for Later" saves the course with a generic name like "Scanned Course" -- and the user has no way to fix it on this screen.

Note: The other save screen (the scanning result view) already has an editable course name input. This change brings the tee-select page to parity.

### Change

**File: `src/components/SetupWizard.tsx`**

Replace the static course name display in the "Select Tee Box" section with an editable input field:

**Current UI (lines 1391-1398):**
- Green success banner with "Course data extracted!"
- Static `<p>` tag showing `courseName` (read-only)

**Updated UI:**
- Green success banner with "Course data extracted!" (unchanged)
- Editable `Input` field for course name, pre-filled with the extracted name
- Editable `Input` field for course location (optional)
- Both fields update `courseName` and `courseLocation` state so "Save Course for Later" uses the corrected values

This is a small, focused change -- just swapping the static text for input fields in the course name preview section of the tee-select step. No new hooks, state, or database changes needed.

