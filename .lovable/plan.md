

# Fix: GHIN refresh returns the wrong golfer

## The bug

In Profile → Refresh GHIN, Josh Brannan (GHIN `8809034`, currently saved with handicap 13.7) is getting a different player's data pulled in.

The cause is in `supabase/functions/sync-ghin-handicap/index.ts`. The function calls:

```
GET /api/v1/golfers/search.json?golfer_id=8809034&status=Active&per_page=1&page=1
```

…then blindly takes `golfers[0]` and returns it. The GHIN `search.json` endpoint is a **fuzzy/multi-field search**, not an exact-by-id lookup — when the requested GHIN # has no active record (or matches a substring), the API returns the first arbitrary golfer it found. Combined with `per_page=1`, the function happily returns the wrong person and overwrites the user's profile with their handicap.

There is no verification that `golfers[0].golfer_id == ghin_number`.

## Fix

In `supabase/functions/sync-ghin-handicap/index.ts`:

1. **Verify exact match**: After receiving search results, find the golfer whose `golfer_id` (or `ghin_no` field, normalized to string) **strictly equals** the requested `ghin_number`. If none matches, return 404 ("No active golfer found with that GHIN number") instead of falling back to `golfers[0]`.
2. **Widen the search window**: Bump `per_page=1` to `per_page=10` so the exact match isn't missed when the API returns several loose matches.
3. **Log mismatch cases** (without leaking PII): if results came back but no exact match was found, `console.warn` the requested GHIN and the count of returned golfers to aid future debugging.
4. Apply the same exact-match logic in the response payload so `golfer_name` and `club_name` always reflect the verified golfer.

## Cleanup for Josh's profile

After the function fix is deployed, Josh should hit Refresh GHIN again. If `8809034` is in fact not his GHIN, the function will now return 404 and his profile will keep its current value — he can then enter his correct GHIN. If the user confirms `8809034` is incorrect, we can also clear the bad value from his profile via a one-off SQL update, but only after the user verifies.

## Files changed

- **`supabase/functions/sync-ghin-handicap/index.ts`** — exact-match validation, widened search, mismatch logging.

## Out of scope

- No changes to the Profile UI or `useAuth` hook are needed; the bug is entirely server-side.
- No DB schema changes.

