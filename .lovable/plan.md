

# Fix: GHIN Sync Fails During Sign Up (No Auth Token)

## Root Cause

During sign up (line 223 of `Auth.tsx`), the app calls `sync-ghin-handicap` to validate the GHIN number **before** the user account exists. The edge function requires a valid JWT (`authorization` header) — but since the user hasn't signed up yet, there's no session token. The function returns a 401 "Missing authorization" error.

## Fix

Restructure the signup flow to defer the GHIN API call until after the account is created and a session exists.

### `src/pages/Auth.tsx` — Reorder signup logic

**Current flow:**
1. Call `sync-ghin-handicap` (fails — no auth token)
2. Call `signUp()`
3. Call `sync-ghin-handicap` again with `update_profile: true`

**Fixed flow:**
1. Validate GHIN format only (5-9 digits — already done client-side)
2. Call `signUp()` with handicap=0 as placeholder
3. After signup succeeds and session is available, call `sync-ghin-handicap` with `update_profile: true` to validate + save the real handicap
4. If GHIN lookup fails post-signup, show a non-blocking warning (account is created, they can retry from Edit Profile)

Changes to `handleSubmit` in the `else` (signup) branch (~lines 216-284):
- Remove the pre-signup GHIN validation block (lines 220-242)
- Always sign up with `hcap = parseFloat(handicapIndex) || 0` (manual value or 0)
- After signup succeeds, if `handicapMethod === 'ghin' && ghinNumber`, wait for session then call `sync-ghin-handicap` with `update_profile: true`
- If that call fails, show `toast.warning('GHIN sync failed — you can link it later in Edit Profile')` instead of blocking signup

### No edge function changes needed
The edge function is correct — it should require auth. The bug is purely in the client calling it before auth exists.

## File
- `src/pages/Auth.tsx` — reorder GHIN sync to happen after successful signup

