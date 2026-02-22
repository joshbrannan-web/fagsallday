

## Integrate GolfCourseAPI.com as Primary Course Data Source

### What This Does

Replaces the unreliable BlueGolf scraping pipeline with GolfCourseAPI.com -- a dedicated golf course API that returns structured scorecard data directly, with no CAPTCHA issues. Your API key has been verified against their documentation.

### API Key Storage

Your GolfCourseAPI.com key (`3IB6B2PEFCVNH62LYJ4V4INR6Y`) will be stored as a secure backend secret (`GOLF_COURSE_API_KEY`) so it's never exposed in client code.

### How the New Flow Works

1. **Search**: User types a course name -> calls `GET /v1/search?search_query=...` -> returns a list of matching courses with IDs and locations
2. **Fetch Details**: User selects a course -> calls `GET /v1/courses/{id}` -> returns full scorecard with all tee boxes, par, yardage, handicap index, rating, and slope
3. **Fallback Chain**: If GolfCourseAPI returns no results, fall back to the verified courses library, then to BlueGolf scraping as a last resort

### Data Mapping

The API returns data in this structure per tee box:
- `tee_name`, `course_rating`, `slope_rating`, `total_yards`, `par_total`
- `holes[]` with `par`, `yardage`, `handicap` for each hole

This maps directly to the app's existing `HoleData` type (`number`, `par`, `yardage`, `handicapIndex`).

### Technical Changes

All changes in `supabase/functions/search-course/index.ts`:

#### 1. Add GolfCourseAPI search function
- New `searchGolfCourseAPI(query, apiKey)` function
- Calls `GET https://api.golfcourseapi.com/v1/search?search_query=...`
- Header: `Authorization: Key <apiKey>`
- Returns list of courses with their API IDs and locations

#### 2. Add GolfCourseAPI fetch-details function
- New `fetchFromGolfCourseAPI(courseId, apiKey)` function
- Calls `GET https://api.golfcourseapi.com/v1/courses/{id}`
- Extracts the male tee boxes by default (with all hole data)
- Maps to existing `CourseData` format

#### 3. Update search mode handler
- Try GolfCourseAPI first for search
- Convert results to `CourseListItem[]` format (using API course ID as the URL identifier)
- Fall back to existing Firecrawl/BlueGolf pipeline if API returns no results

#### 4. Update fetch mode handler
- Detect GolfCourseAPI course IDs (numeric) vs BlueGolf URLs
- Route to appropriate fetcher
- Keep existing BlueGolf + verified course fallback chain intact

#### 5. Store API key as secret
- Add `GOLF_COURSE_API_KEY` as a backend secret

### What Stays the Same

- Verified courses library and fallback logic
- BlueGolf scraping (kept as last-resort fallback)
- Scan Scorecard feature (image-based parsing)
- Client-side code and UI (no changes needed)
- All existing course data formats

