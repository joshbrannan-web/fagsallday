

## Auto-Logout on New Deployment

### Approach

Use a **build hash** embedded at build time. On app load, compare the stored hash in localStorage against the current one. If they differ, a new version was deployed — sign the user out (unless they have an active round).

### Implementation

**1. Inject build timestamp via Vite** (`vite.config.ts`)

Add a `define` entry: `'__APP_BUILD_HASH__': JSON.stringify(Date.now().toString())`. This creates a unique value per build/publish.

**2. Create version check hook** (`src/hooks/useVersionCheck.ts`)

- On mount, read `fg_build_hash` from localStorage and compare to `__APP_BUILD_HASH__`
- If they match (or no stored hash yet), store the current hash and return
- If they differ:
  - Check `offlineStorage.getCachedRound()` — if an ACTIVE round exists, skip logout (store hash so it doesn't re-trigger)
  - Otherwise, call `supabase.auth.signOut()`, clear all `fg_*` localStorage keys, and show a toast: "App updated — please sign in again"
- Always update the stored hash after the check

**3. Wire it up** (`src/App.tsx`)

Call `useVersionCheck()` near the top of the App component, before auth-dependent rendering. This runs once on mount.

### Why this works

Every publish produces a new build with a new `Date.now()` value baked in. Existing sessions in the browser still have the old hash. On next page load (refresh, revisit), the mismatch triggers a logout. Active rounds are protected by the cache check.

