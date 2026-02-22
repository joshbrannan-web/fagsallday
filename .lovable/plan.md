

## Fix Course Search Edge Function

Three issues to address: CORS blocking preview domains, trailing dashes in course names, and missing/incorrect location data in results.

### 1. CORS Fix

**Problem**: `allowedOrigins` on line 4 only includes production domains. The Lovable preview domain is blocked.

**Fix**: Change from a strict allowlist to allowing `*` for the CORS origin (matching the pattern used by other edge functions in the project). This is safe because the function already validates authentication via JWT.

**File**: `supabase/functions/search-course/index.ts`
- Line 4: Replace the `allowedOrigins` array approach with `'Access-Control-Allow-Origin': '*'`
- Remove the origin-checking logic throughout the file (lines 50-55, 134-135, 141)

### 2. Course Name Cleanup

**Problem**: `extractCourseName()` produces names like `"Pebble Beach Golf Links -"` because the BlueGolf title format is `"Pebble Beach Golf Links - Detailed Scorecard | Course Database"` and the regex only strips from `BlueGolf` or `Scorecard` keywords, leaving a trailing ` -`.

**Fix**: In `extractCourseName()` (line 197), add a final cleanup step to strip trailing ` -` or ` |` characters after the existing replacements.

**File**: `supabase/functions/search-course/index.ts`
- After line 203, add: `.replace(/\s*[-|]+\s*$/, '')`

### 3. Location Extraction Improvements

**Problem**: The regex-based `extractLocationFromResult()` fails on most BlueGolf results because the search snippets rarely contain city/state info. It sometimes picks up table headers like "In, Tot".

**Fix**: Two-part approach:
1. Improve `extractLocationFromResult()` to exclude known false positives (like "In, Tot", "Out, In") and add the BlueGolf description patterns
2. In the AI system prompt for `fetchCourseDetails()`, explicitly instruct the model to extract the course location from the page content (BlueGolf pages typically show the address). The AI already returns a `location` field -- the prompt just needs to emphasize extracting it from the page rather than leaving it blank.
3. When `fetchCourseDetails` is called for a single result, pass the search-result location through so it can be used as a fallback.

**File**: `supabase/functions/search-course/index.ts`
- Update `extractLocationFromResult()` (lines 176-194): Add a blocklist filter for false positives like "In, Tot", "Out, In", "Show All"
- Update the AI system prompt (line 379): Change `"location": "City, State"` guidance to emphasize looking for the address/location on the BlueGolf page and to never leave it as empty
- Update `fetchCourseDetails` signature to accept an optional `location` parameter from search results, used as fallback if AI can't find one

### 4. Pass Location from Search to Fetch

When a single course is found and we auto-fetch details (line 290-292), pass the extracted location so it can serve as a fallback in the AI parse.

### Summary of Changes

All changes are in one file: `supabase/functions/search-course/index.ts`

1. Simplify CORS to `'*'` (safe because auth is enforced)
2. Add `.replace(/\s*[-|]+\s*$/, '')` to `extractCourseName`
3. Add false-positive filter to `extractLocationFromResult`
4. Update AI prompt to emphasize location extraction
5. Thread location through `fetchCourseDetails` as fallback
