

## Test GolfCourseAPI.com API Key

### Goal
Validate the API key `MNkB6GU8KS4C7D7JLR3HR9NG3XQ` works with GolfCourseAPI.com before committing to the full integration.

### Approach
Create a temporary test edge function that makes real API calls and returns the results. This lets us confirm:
1. The API key is valid and accepted
2. The search endpoint returns structured course data  
3. The course detail endpoint returns tee box/hole data in the expected format
4. We understand the exact response structure for mapping to our app types

### Steps

**Step 1: Create a temporary test function** (`supabase/functions/test-golf-api/index.ts`)

This function will:
- Call `GET https://api.golfcourseapi.com/v1/search?search_query=pinehurst` with the API key
- If the search succeeds, extract the first course ID from the results
- Call `GET https://api.golfcourseapi.com/v1/courses/{id}` with that ID
- Return both raw responses so we can inspect the exact data structure

The function will try multiple common auth header formats to find the right one:
- `Authorization: Key MNkB6GU8KS4C7D7JLR3HR9NG3XQ`
- `Authorization: Bearer MNkB6GU8KS4C7D7JLR3HR9NG3XQ`
- `x-api-key: MNkB6GU8KS4C7D7JLR3HR9NG3XQ`

**Step 2: Deploy and call it**

Deploy the test function, call it, and inspect the response to confirm data quality.

**Step 3: Clean up**

Delete the test function once we've confirmed the key works and documented the response format.

### What We Learn
- Exact auth header format required
- Response schema for search results (field names, nesting)
- Response schema for course details (how tee boxes, holes, par, yardage, handicap are structured)
- Whether the free tier key works and returns complete data

This validation takes about 2 minutes and saves us from building the full integration against incorrect assumptions.

