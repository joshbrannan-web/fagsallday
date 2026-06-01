## What I found

- The hosted backend is healthy.
- For `kevinbenemusic@gmail.com`, the reset email was generated at `21:27:52` and the auth system recorded a successful recovery-login at `21:28:03`.
- The logs also show `One-time token not found` immediately before/around repeated clicks. That means the email token is getting consumed successfully, but the app then fails to keep/use the recovery session, so the user lands back on the forgot-password screen and sees “link expired.”
- The likely frontend bug is in the reset handling: the app relies on passive auth events and `getSession()` polling, but does not explicitly exchange the `?code=` from the recovery URL. On production/mobile email flows, this can race or lose the session.

## Plan

1. **Make recovery code exchange explicit in `Auth.tsx`**
   - Detect `?code=...` + `mode=reset` on page load.
   - Call `supabase.auth.exchangeCodeForSession(code)` directly before showing/using the reset form.
   - Track recovery states: `checking`, `ready`, `expired`.
   - Only show the “link expired” message after the explicit exchange fails, not just because `getSession()` is momentarily empty.

2. **Stop redirect/cleanup from interfering with reset links**
   - Preserve recovery query parameters while the exchange is running.
   - Keep normal signed-in redirects disabled during reset mode.
   - Clear the URL only after exchange succeeds so refreshes do not re-use the same one-time code.

3. **Improve reset-screen messaging**
   - While exchanging the link, show a loading state like “Opening your reset link...” instead of the forgot-password form.
   - If exchange fails, show a clearer inline error and a button to request a fresh link.
   - Keep existing inline password validation and success message.

4. **Re-check backend email link generation**
   - Keep `generate-reset-link` and `admin-reset-password` using the provider `action_link` directly.
   - Add small defensive logging around the generated redirect target only, without logging full tokens.

## Validation

- Use backend auth logs to confirm a new recovery link produces one successful `/verify` event and no immediate app-side “expired” flow.
- Verify the frontend reset route handles `https://fagsallday.com/?code=...#/auth?mode=reset` and `https://fagsallday.com/#/auth?mode=reset&code=...` style URLs robustly.