

## Fix CORS for GHIN Sync Edge Function

The GHIN sync edge function is working correctly server-side, but the browser is rejecting the response because the CORS `Access-Control-Allow-Origin` header doesn't include the Lovable preview domain.

### The Problem

The edge function has a hardcoded allowlist of origins:
- `https://fagsallday.com`
- `https://www.fagsallday.com`  
- `https://fagsallday.lovable.app`

But the preview runs on `https://902ceb91-387f-4b92-88e1-503add1c6d7a.lovableproject.com`, which is not in the list.

### The Fix

Update `supabase/functions/sync-ghin-handicap/index.ts` to use a wildcard `Access-Control-Allow-Origin: *` header (consistent with Lovable's recommended CORS pattern for edge functions), or add a pattern match for `.lovableproject.com` domains.

Using `*` is the simplest and recommended approach since the function already validates the JWT for security.

### Technical Details

In `supabase/functions/sync-ghin-handicap/index.ts`:
- Replace the `ALLOWED_ORIGINS` array and `getCorsHeaders` function with a simple `corsHeaders` object using `'Access-Control-Allow-Origin': '*'`
- Update all `Response` constructors to use the simplified `corsHeaders`

This is a one-file change. The function's JWT validation already ensures only authenticated users can call it.
