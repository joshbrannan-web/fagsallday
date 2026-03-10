

# Fix Password Reset "Link Expired" Error

## Root Cause

When the user clicks the reset link in the email, the URL becomes something like:
`https://fagsallday.com/?code=ABC123#/auth?mode=reset`

The Supabase client detects `?code=` and starts an async PKCE code exchange. Meanwhile, `useAuth` correctly skips stale-session cleanup and sets `isLoading = false` immediately, rendering the reset form. The user enters a new password and submits — but the PKCE exchange may still be in-flight. `getSession()` returns null, the 2-second single retry fails, and the user sees "reset link has expired."

## Changes

### `src/pages/Auth.tsx`

**1. Track when recovery session is ready (lines 60-69)**

Add a `recoverySessionReady` ref that the `PASSWORD_RECOVERY` / `SIGNED_IN` listener sets to `true`:

```typescript
const recoverySessionReady = useRef(false);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isResetFromUrl.current)) {
      recoverySessionReady.current = true;
      setMode('reset');
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

**2. Replace fixed 2s wait with polling loop in `handleResetPassword` (lines 146-158)**

Poll `getSession()` every 500ms for up to 10 seconds, and also check the `recoverySessionReady` ref as an early-exit signal:

```typescript
let { data: { session: currentSession } } = await supabase.auth.getSession();
if (!currentSession) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const retry = await supabase.auth.getSession();
    currentSession = retry.data.session;
    if (currentSession) break;
  }
}
```

**2 sections changed in 1 file.**

