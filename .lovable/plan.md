

## Auto-Sync GHIN Handicap on Sign-In

Currently the GHIN sync only runs when the user manually clicks "Refresh" on the Profile page, or when opening the SetupWizard. This change will add an automatic sync when the user signs in, if they have a linked GHIN number and it hasn't been synced in the last 24 hours.

### What Will Happen

After signing in, the app will silently check your GHIN handicap in the background. If it has been more than 24 hours since the last sync, it will automatically pull your latest handicap from USGA and update your profile. You will see a small notification if your handicap changed.

### Technical Details

**File: `src/hooks/useAuth.tsx`**

Add auto-sync logic inside the `onAuthStateChange` listener, specifically on the `SIGNED_IN` event:

1. After the profile is fetched on `SIGNED_IN`, check if:
   - `profile.ghin_number` exists
   - `profile.ghin_last_synced` is either null or older than 24 hours
2. If both conditions are met, call `supabase.functions.invoke('sync-ghin-handicap', { body: { ghin_number, update_profile: true } })` in the background
3. On success, update the local profile state with the new `handicap_index` and `ghin_last_synced` values
4. Show a toast only if the handicap actually changed (e.g., "Handicap updated to 12.3")
5. Failures are silently ignored (non-blocking) since manual refresh is always available

This is a single-file change. The edge function already handles everything server-side -- this just triggers it automatically at sign-in.
