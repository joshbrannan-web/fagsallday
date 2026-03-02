

## CoursePicker Component + Tournament Round Integration

### New File: `src/components/CoursePicker.tsx`

A self-contained course search and selection component that provides:

1. **Search input** for course name + optional location
2. **Saved courses** section — fetches from `saved_courses` table via existing `useSavedCourses` hook from AppContext
3. **Verified community courses** — searches `verified_courses` table via `useVerifiedCourses` hook
4. **External search** — calls `searchCourse()` and `fetchCourseDetails()` from `@/lib/api/courseSearch`
5. **Scorecard scan** — camera upload calling `parse-scorecard` edge function, with tee box selection
6. **Course loaded confirmation** — shows par/yardage summary when a course is selected
7. **Pre-populated state** — accepts an optional `initialCourse` prop; when provided, shows the course name with a "Change" button to re-enter search mode

**Props interface:**
```typescript
interface CoursePickerProps {
  selectedCourse: Course | null;
  onCourseSelected: (course: Course) => void;
}
```

The component manages its own internal state (search mode, results, loading) but calls `onCourseSelected` when a course is chosen, passing the full `Course` object with all 18 holes.

This does NOT modify SetupWizard.tsx — the existing code continues to use its own inline course selection logic unchanged.

### Modified File: `src/components/tournament-admin/RoundConfigCard.tsx`

Add a `CoursePicker` between the round name/date row and the notes textarea. Wire `onCourseSelected` to update `data.courseData` with the full course object via the existing `update('courseData', course)` pattern. When `data.courseData` is already set, pass it as `selectedCourse` so it shows the pre-populated state.

### Data Flow

When a course is selected in the CoursePicker:
- The full `Course` object (id, name, location, holes[18] with number/par/yardage/handicapIndex) is stored in `RoundConfigData.courseData`
- On wizard publish, this flows into `tournament_rounds.course_data` via the existing `createTournament` function in `useTournaments.ts`
- When editing an existing round, the `courseData` from the database pre-populates the picker

### Files Created
- `src/components/CoursePicker.tsx`

### Files Modified
- `src/components/tournament-admin/RoundConfigCard.tsx` — add CoursePicker import and usage

### Files NOT Modified
- `src/components/SetupWizard.tsx` — unchanged, continues working as before

