# Password Reset Fixes

Goal: make the admin-triggered reset email actually work, give admins a no-email fallback, and make the user-facing reset form clearer when something goes wrong.

## 1. Fix `admin-reset-password` edge function

The current function builds a custom `?token=...&type=recovery` URL, but `src/pages/Auth.tsx` only knows how to handle the PKCE `?code=` flow. Result: every admin-triggered reset email lands on a page that immediately says "Your reset link has expired."

Change:
- Drop the manual URL rebuild.
- Call `generateLink({ type: "recovery", email, options: { redirectTo: `${requestOrigin}/#/auth?mode=reset` } })`.
- Use `linkData.properties.action_link` directly as `resetLink` in the email (same approach `generate-reset-link` already uses successfully).
- Keep existing admin check, rate limit, and Resend email body.

## 2. Add "Set temporary password" admin action

New edge function `admin-set-password`:
- Verifies caller is admin (same pattern as `admin-reset-password`).
- Accepts `{ userId, password? }`. If `password` is omitted, generate a 12-char random password (letters + digits + 1 symbol).
- Calls `supabaseAdmin.auth.admin.updateUserById(userId, { password })`.
- Returns `{ success: true, temporaryPassword: "<value>" }` so the admin can read it back and hand it to the user.
- Rate-limited: 10/min/admin.
- No email sent — this is the offline fallback.

UI in `src/pages/Admin.tsx`:
- Next to the existing "Reset password" button on each user row, add a "Set temp password" button (KeyRound icon).
- Confirms via AlertDialog ("This will overwrite the user's password. A temporary password will be displayed once — copy it now.").
- On success, show the generated password in a dialog with a Copy button. Toast on copy.

## 3. Improve user-facing reset form

In `src/pages/Auth.tsx` `handleResetPassword`:
- Inline-validate password length (≥6) and confirm-match before calling `updateUser`, showing red helper text under the relevant field instead of just a toast.
- On success, lengthen the toast (5s) and use copy: "Password updated. You can now sign in with your new password." Then redirect to `/auth?mode=signin` (already happens, but make the message explicit).
- If `updateUser` returns an "Auth session missing" / expired-link error, surface a clearer message: "This reset link has expired. Request a new one from Forgot Password."

## 4. Log Resend failures in `generate-reset-link`

Currently the function logs the success response but does not check whether Resend returned an error object. Change:
- `if (emailResponse.error) { console.error("Resend send failed:", emailResponse.error); return 500 }`
- Still keep the rate-limit fake-success behavior unchanged.

## Files touched

- `supabase/functions/admin-reset-password/index.ts` — use action_link as-is
- `supabase/functions/admin-set-password/index.ts` — new
- `supabase/functions/generate-reset-link/index.ts` — log Resend errors
- `src/pages/Admin.tsx` — add "Set temp password" button + result dialog
- `src/pages/Auth.tsx` — inline validation + clearer messaging

## Out of scope

- Switching to Lovable Emails for auth
- Changing recovery token TTL (Supabase default)
- Auto-confirming email signups
