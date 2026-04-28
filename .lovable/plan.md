

# Fix: GHIN exact-match check rejects valid GHIN 10988439

## What's happening

Edge logs from `sync-ghin-handicap` show:

```
GHIN exact-match miss: requested=10988439, returned 1 loose match(es)
```

The GHIN API **is** returning a golfer record, but my new exact-match guard from the previous fix doesn't recognize the ID field on it. I'm only checking `golfer_id`, `ghin_no`, and `id` — but GHIN's `search.json` response uses different field names (likely `ghin_number`, `GHINNumber`, or similar), so the strict equality fails and the user sees "No active golfer found".

The previous bug (silently returning the wrong golfer) was real, but the fix is now too strict and rejects legitimate lookups.

## Fix

In `supabase/functions/sync-ghin-handicap/index.ts`:

1. **Expand the candidate ID fields** checked when verifying the returned golfer. Look at: `golfer_id`, `ghin_no`, `ghin_number`, `GHINNumber`, `ghin`, `id`. Compare each to the requested GHIN as trimmed strings.
2. **Add diagnostic logging** on the exact-match-miss path: log the keys present on `golfers[0]` and the values of any id-like fields. This way if GHIN ever changes their schema again, we'll see it immediately in logs and can add the new field name in one edit.
3. Keep the safety net — if no field matches, still return 404 (never silently overwrite the profile with a different golfer's data).

## Files changed

- **`supabase/functions/sync-ghin-handicap/index.ts`** — broaden id-field candidates, add debug logging on miss.

## Verification

After deploy, the user retries Refresh GHIN with `10988439`. Either:
- It succeeds and returns the right golfer, OR
- The 404 still fires but the new log line reveals which field name GHIN is actually using, and we add it.

