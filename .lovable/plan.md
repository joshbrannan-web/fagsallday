

## Fix: Unable to Log Out or Refresh with Expired Session

### Problem
The user's session was invalidated server-side, but the app still holds a stale token in localStorage. When signing out, `supabase.auth.signOut()` tries to call the server's `/logout` endpoint, which returns a 403 ("Session not found"). The app then gets stuck — it can't log out and can't refresh because it keeps trying to use the dead session.

### Root Cause
The `signOut` function in `useAuth.tsx` doesn't handle the case where the server rejects the logout. The local auth state (user, session, profile) is never cleared when this happens.

### Solution
Two changes in `src/hooks/useAuth.tsx`:

1. **Make `signOut` resilient** — Always clear local state (user, session, profile, localStorage) even if the server `/logout` call fails.

2. **Handle stale sessions on app load** — In the initial `getSession()` call, verify the session is still valid by calling `getUser()`. If it returns an error (session expired), clear everything locally so the user sees the sign-in screen instead of a broken state.

### Technical Details

**File: `src/hooks/useAuth.tsx`**

**Change 1 — `signOut` function (around line 143):**
```typescript
const signOut = async () => {
  // Always clear local state, even if server call fails
  setUser(null);
  setSession(null);
  setProfile(null);
  localStorage.removeItem('fg_session_start');
  
  try {
    await supabase.auth.signOut();
  } catch (e) {
    // Server rejection is fine — local state is already cleared
    console.warn('Sign out server call failed:', e);
  }
};
```

**Change 2 — Initial session check (around line 87):**
After `getSession()` returns a session, verify it's still valid with `getUser()`. If the session is stale, sign out locally:
```typescript
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (session?.user) {
    // Verify session is still valid server-side
    const { error: userError } = await supabase.auth.getUser();
    if (userError) {
      // Session is stale — clear everything
      setSession(null);
      setUser(null);
      setProfile(null);
      localStorage.removeItem('fg_session_start');
      setIsLoading(false);
      return;
    }
    setSession(session);
    setUser(session.user);
    fetchProfile(session.user.id).then((p) => {
      setProfile(p);
      setIsLoading(false);
    });
  } else {
    setIsLoading(false);
  }
});
```

These two changes ensure the app never gets stuck on a dead session — it either recovers gracefully or sends the user to the sign-in screen.
