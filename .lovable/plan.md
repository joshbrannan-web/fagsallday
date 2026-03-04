

# Fix: Password Reset "Update Password" Error

## Root Cause

When a user clicks the password reset link in their email, this happens:

1. They land on the app with a `?code=xxx` query param (PKCE flow)
2. The Supabase JS client detects the code and starts exchanging it for a session **asynchronously**
3. Meanwhile, `useAuth`'s `getSession()` call runs — it may find a **stale cached session** from a previous login
4. `getUser()` validates it, finds it stale, and calls `signOut()` — **this kills the in-progress PKCE code exchange**
5. The recovery session is never established
6. When the user submits their new password, `updateUser({ password })` fails because there's no active session

Even without a stale session, there's a race: `getSession()` returns null (code not yet exchanged), sets `isLoading = false`, and the user sees the reset form. The code exchange may still be in progress. If they submit quickly, `updateUser` fails.

## Fix (2 files)

### 1. `src/hooks/useAuth.tsx` — Don't nuke sessions during recovery flow

Before the stale-session validation block, detect if the URL contains a recovery code (`?code=` with `mode=reset` or `type=recovery`). If so, **skip the stale session cleanup entirely** and let the Supabase client complete the code exchange naturally. The `onAuthStateChange` listener will pick up the `SIGNED_IN` / `PASSWORD_RECOVERY` event when the exchange completes.

```typescript
// Before the getSession() validation block:
const urlHasRecoveryCode = window.location.search.includes('code=') && 
  (window.location.hash.includes('mode=reset') || window.location.search.includes('type=recovery'));

supabase.auth.getSession().then(async ({ data: { session: cachedSession } }) => {
  if (urlHasRecoveryCode) {
    // Recovery flow in progress — don't validate/clear cached session.
    // Let the PKCE code exchange complete; onAuthStateChange will handle it.
    setIsLoading(false);
    initialValidationDone.current = true;
    return;
  }
  // ... existing stale session validation logic unchanged
});
```

### 2. `src/pages/Auth.tsx` — Guard `updateUser` with session check + retry

In `handleResetPassword`, before calling `updateUser`, verify an active session exists. If not, wait briefly for the code exchange to complete, then retry. Show a clear error if no session after retrying.

```typescript
const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  // ... existing validation ...

  setIsSubmitting(true);
  try {
    // Ensure we have an active session (code exchange may still be in flight)
    let { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      // Wait for PKCE code exchange to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retry = await supabase.auth.getSession();
      currentSession = retry.data.session;
    }

    if (!currentSession) {
      toast.error('Your reset link has expired. Please request a new one.');
      setMode('forgot');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message.includes('session') || error.message.includes('token')) {
        toast.error('Your reset link has expired. Please request a new one.');
        setMode('forgot');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Password updated successfully! Redirecting...');
      navigate('/');
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

## Summary
- **File 1:** `src/hooks/useAuth.tsx` — Skip stale-session cleanup when a recovery code is in the URL
- **File 2:** `src/pages/Auth.tsx` — Add session check with brief retry before `updateUser`, and show user-friendly error if session is missing

