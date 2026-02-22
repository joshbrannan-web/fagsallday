

## Fix GHIN Sync - API Compatibility

The GHIN sync is failing with a 400 error because the edge function is using an outdated API format. Two changes are needed in `supabase/functions/sync-ghin-handicap/index.ts`:

### Changes

1. **Fix the login API URL** from `https://api.ghin.com/api/v1/golfer_login.json` to `https://api2.ghin.com/api/v1/golfer_login.json`

2. **Add the required `token` field** to the login request body (an arbitrary value required by the GHIN API):
   ```
   body: { user: { ... }, token: "123" }
   ```

3. **Fix the search API URL** from `https://api.ghin.com/api/v1/golfers/search.json` to `https://api2.ghin.com/api/v1/golfers/search.json`

### Technical Details

In `supabase/functions/sync-ghin-handicap/index.ts`:
- Line ~89: Change login URL to `https://api2.ghin.com/api/v1/golfer_login.json`
- Line ~92: Add `token: "123"` alongside the `user` object in the request body
- Line ~108: Change search URL to `https://api2.ghin.com/api/v1/golfers/search.json`

These are the only changes needed. The rest of the function logic (auth, rate limiting, profile update) is correct.

