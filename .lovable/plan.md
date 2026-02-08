

## Verified Course Library

### Overview

Add a shared, community-driven library of verified courses. Any authenticated user can "verify" one of their saved courses with a single click, making its scorecard data (par, handicap index, yardage for all 18 holes) available to all users. When searching for a course, the verified library is checked first -- giving instant results before falling back to the external database search.

### How It Works

1. **Verifying a course**: On any saved course card (in Favorites or Recently Played), a new "Verify" icon appears. Tapping it publishes that course's scorecard to the shared library. The user who verified it is credited.

2. **Searching**: When a user types a course name and clicks "Search Course Database", the system first searches the verified library (instant, local query). If matches are found, they appear at the top labeled "Verified by community" with a checkmark badge. The external BlueGolf search still runs below if the user wants to try it.

3. **Using a verified course**: Clicking a verified course result loads the full scorecard data instantly -- no waiting for external scraping or AI parsing. The data comes directly from the database.

### Database Changes

**New table: `verified_courses`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `course_name` | text | Normalized course name (for search) |
| `course_location` | text | City, State format |
| `course_data` | jsonb | Full Course object (holes with par, yardage, handicap) |
| `verified_by` | uuid | User ID who verified it |
| `verified_at` | timestamptz | When it was verified |
| `total_par` | integer | For display purposes |
| `total_yardage` | integer | For display purposes |

**RLS Policies:**
- SELECT: All authenticated users can read all verified courses
- INSERT: Authenticated users can insert rows where `verified_by = auth.uid()`
- UPDATE: Only the user who verified can update their entry (for corrections)
- DELETE: Only the user who verified or an admin can delete

**Unique constraint**: On `course_name` (case-insensitive) to prevent duplicates. If someone tries to verify a course that already exists, they'll see it's already verified.

### File Changes

**Step 1: Database migration**

Create the `verified_courses` table with columns, RLS policies, and a unique index on `lower(course_name)`.

---

**Step 2: New hook -- `src/hooks/useVerifiedCourses.tsx`**

A new hook to manage the verified courses library:
- `searchVerifiedCourses(query: string)` -- searches by name using `ilike` pattern matching
- `verifyCourse(course: Course)` -- inserts a course into the verified library
- `isVerified(courseName: string)` -- checks if a course name is already verified
- Returns loading states and error handling

---

**Step 3: Update `src/components/SetupWizard.tsx`**

Changes to the search flow in "Search All Courses" mode:

- Import and use `useVerifiedCourses` hook
- When user clicks "Search Course Database":
  1. First, query `verified_courses` using `searchVerifiedCourses(courseName)` (instant)
  2. Display verified results at the top with a checkmark badge and "Verified" label
  3. Then run the existing external search (BlueGolf/Firecrawl) in parallel
  4. External results appear below, separated by a divider
- Clicking a verified result loads the course data instantly (no API call needed)

Changes to saved course cards (Favorites and Recently Played sections):
- Add a "Verify" button (shield/badge icon) next to the star/delete buttons
- If the course is already verified, show a static checkmark badge instead
- On click: calls `verifyCourse(course)` and shows a success toast

---

**Step 4: Update `src/lib/api/courseSearch.ts`**

Add a new function `searchVerifiedLibrary(query: string)` that queries the `verified_courses` table directly using the Supabase client. This runs client-side (no edge function needed) and returns matching courses.

---

### UI Details

**Verified course search result card:**
- Green checkmark badge with "Verified" text
- Course name and location
- Shows "Par XX | X,XXX yards"
- Clicking loads data instantly

**Verify button on saved courses:**
- Shield icon (from lucide-react `ShieldCheck`)
- Appears next to the star and delete buttons
- Disabled if course has no hole data (all defaults)
- Toast: "Course verified and shared with all players!"

**Already-verified indicator:**
- If a saved course matches a verified course name, show a small "Verified" badge on the card

### What Stays the Same

- External course search (BlueGolf/Firecrawl) remains fully functional as a fallback
- Saved courses per-user are unchanged
- Favorites system is unchanged
- Scan Scorecard flow is unchanged
- Course editing (hole details) is unchanged
