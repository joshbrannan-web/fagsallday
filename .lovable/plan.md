

## Plan: Editable Course Info on Completed Rounds + Lock Feature

### Overview
Two features:
1. **Edit Course Name/Location** on completed (but not locked) rounds from the Round Summary view
2. **Lock a Round** to finalize it permanently, moving it into a "Completed Rounds" section in the history view

---

## Part 1: Edit Course Name & Location on Completed Rounds

### Where It Appears
On the **Round Summary** page (`RoundSummary.tsx`), when viewing a completed round, the course name and location will become tappable/editable fields.

### Behavior
- Tapping the course name or location shows inline edit fields (same pattern as the existing amount editing)
- Only available when the round status is `COMPLETE` (not `LOCKED`)
- Saves the updated `course_data` to the database

### Implementation

**File: `src/hooks/useRounds.tsx`**
- Expand `updateRound` to also accept `course` updates
- Add `course_data` mapping in the database update logic

**File: `src/contexts/AppContext.tsx`**
- Add `updateRoundCourse: (courseName: string, courseLocation: string) => void` to AppState

**File: `src/App.tsx`**
- Wire up `updateRoundCourse` that calls `updateRound` with updated course data

**File: `src/components/RoundSummary.tsx`**
- Add edit icons next to course name and location in the header
- Add inline editing state (same Edit2/Check/X pattern used for amount editing)
- Only show edit controls when round is `COMPLETE` (not `LOCKED`)

---

## Part 2: Lock a Finished Round

### New Status
Add `LOCKED` as a fourth round status alongside `SETUP`, `ACTIVE`, and `COMPLETE`.

### Behavior
- A "Lock Round" button appears on the Round Summary when viewing a `COMPLETE` round
- Locking changes the status to `LOCKED`
- Locked rounds cannot be edited (no course name/location changes, no amount adjustments)
- Locked rounds cannot be deleted

### History Page Sections
The Round History page will split into two sections:
1. **Recent Rounds** - Active and Complete rounds (editable, deletable)
2. **Completed Rounds** - Locked rounds (read-only, no delete button)

---

## Technical Details

### File: `src/types.ts`
- Update the Round `status` union type:
```typescript
status: 'SETUP' | 'ACTIVE' | 'COMPLETE' | 'LOCKED';
```

### File: `src/hooks/useRounds.tsx`

**Change 1: Expand updateRound to accept course updates**
```typescript
const updateRound = async (roundId: string, updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status' | 'course'>>) => {
  // ... existing logic ...
  // Add course_data mapping:
  if (updates.course !== undefined) dbUpdates.course_data = updates.course;
};
```

**Change 2: Add lockRound function**
```typescript
const lockRound = async (roundId: string) => {
  return updateRound(roundId, { status: 'LOCKED' });
};
```

Return `lockRound` from the hook.

### File: `src/contexts/AppContext.tsx`
- Add to AppState interface:
```typescript
updateRoundCourse: (courseName: string, courseLocation: string) => void;
lockRound: () => void;
```

### File: `src/App.tsx`
- Wire `updateRoundCourse` to update `currentRound.course` with new name/location via `updateRound`
- Wire `lockRound` from `useRounds` and pass it through context
- Add offline queue support for `course_data` updates in `updateRound`

### File: `src/components/RoundSummary.tsx`

**Change 1: Editable course name/location in header**
- Add state for `editingCourse`, `editCourseName`, `editCourseLocation`
- When tapped (and status is `COMPLETE`), show Input fields for name and location
- Save calls `updateRoundCourse(name, location)`
- When status is `LOCKED`, show a lock icon and no edit controls

**Change 2: Lock Round button**
- Add a "Lock Round" button in the footer area (only when status is `COMPLETE`)
- Clicking shows a confirmation dialog
- On confirm, calls `lockRound()` and shows a success toast
- When round is `LOCKED`, hide the "Finish & Save" button (already saved) and show a "Locked" badge

**Change 3: Disable amount editing when locked**
- When status is `LOCKED`, the leaderboard amounts are read-only (no Edit2 icon, no tap handler)

### File: `src/components/RoundHistory.tsx`

**Change 1: Split into two sections**
```text
+------------------------------------------+
| <- Back          Past Rounds             |
+------------------------------------------+
|                                          |
|  --- Recent Rounds ---                   |
|  [Active/Complete round cards]           |
|  (with delete button)                    |
|                                          |
|  --- Completed Rounds ---                |
|  [Locked round cards with lock icon]     |
|  (no delete button)                      |
|                                          |
+------------------------------------------+
```

- Filter rounds into two arrays: `recentRounds` (ACTIVE + COMPLETE) and `completedRounds` (LOCKED)
- Recent rounds keep existing behavior (deletable, tappable)
- Completed rounds show a lock icon badge, no delete button, still tappable to view

**Change 2: Lock icon on locked round cards**
- Add a small lock icon badge next to the course name for locked rounds (similar to the LIVE badge for active rounds)

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/types.ts` | Add `LOCKED` to Round status union |
| `src/hooks/useRounds.tsx` | Expand `updateRound` to handle `course` field, add `lockRound`, add offline queue for `course_data` |
| `src/contexts/AppContext.tsx` | Add `updateRoundCourse` and `lockRound` to AppState |
| `src/App.tsx` | Wire `updateRoundCourse` and `lockRound` through context |
| `src/components/RoundSummary.tsx` | Add editable course name/location, Lock button, disable edits when locked |
| `src/components/RoundHistory.tsx` | Split into Recent Rounds and Completed Rounds sections |

---

## Visual Summary

### Round Summary - Complete (editable)
```text
+------------------------------------------+
|        [Trophy Icon]                     |
|      Round Complete                      |
|   [Course Name] [edit icon]              |
|   [Location]    [edit icon]              |
+------------------------------------------+
|  Leaderboard (tap to adjust)             |
|  1. Josh    $25  [edit]                  |
|  2. Mike   -$25  [edit]                  |
+------------------------------------------+
|  [Share]  [Scorecard]                    |
|  [Lock Round]                            |
|  [Finish & Save]                         |
+------------------------------------------+
```

### Round Summary - Locked (read-only)
```text
+------------------------------------------+
|        [Trophy Icon]                     |
|      Round Complete [Lock icon]          |
|      Course Name                         |
|      Location                            |
+------------------------------------------+
|  Leaderboard                             |
|  1. Josh    $25                          |
|  2. Mike   -$25                          |
+------------------------------------------+
|  [Share]  [Scorecard]                    |
|  [Home]                                  |
+------------------------------------------+
```

### History Page Sections
```text
+------------------------------------------+
|  Recent Rounds                           |
|  [Card: Oak Hills - LIVE]  [delete]      |
|  [Card: Pine Valley]       [delete]      |
|                                          |
|  Completed Rounds                        |
|  [Card: Augusta - Lock icon]             |
|  [Card: Pebble - Lock icon]              |
+------------------------------------------+
```

