

## Fix: "Save for Later" Disappearing When Editing Course Name

### Problem

After scanning a scorecard, the "Save for Later" and "Verify for Community" buttons disappear when you edit the course name. This happens because the course name input's `onChange` handler (line 1218) calls `setSelectedCourse(null)`, and the buttons are conditionally rendered only when `selectedCourse` is not null (line 1336).

### Root Cause

In `src/components/SetupWizard.tsx`, line 1216-1218:
```typescript
onChange={(e) => {
  setCourseName(e.target.value);
  setSelectedCourse(null);  // <-- This clears the course data
}}
```

The `setSelectedCourse(null)` call was originally intended to reset the course data when a user manually types a new course name (before searching). However, it also fires after a scan, when the user just wants to rename the course -- wiping out the loaded scorecard data and hiding the action buttons.

### Solution

Remove the `setSelectedCourse(null)` call from the course name input's `onChange` handler. The course name is already a separate state variable (`courseName`) from the selected course data, so editing the name doesn't need to invalidate the loaded hole data.

### Changes

**Modified file: `src/components/SetupWizard.tsx`**

Update line 1216-1219 from:
```typescript
onChange={(e) => {
  setCourseName(e.target.value);
  setSelectedCourse(null);
}}
```
to:
```typescript
onChange={(e) => {
  setCourseName(e.target.value);
}}
```

This is a one-line removal. After the change, editing the course name will preserve the loaded scorecard data and keep the "Save for Later" / "Verify for Community" buttons visible.

