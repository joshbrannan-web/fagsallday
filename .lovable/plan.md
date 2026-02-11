

## PWA and Offline Capabilities Enhancement

### Overview

Most of the infrastructure already exists. This plan fills the remaining gaps: improving the service worker, adding round recovery on app load, and cleaning up the Vite config.

### What Already Exists (no changes needed)
- `public/sw.js` - basic service worker (will be improved)
- `public/manifest.json` - web app manifest (will update theme colors per your spec)
- `index.html` - already has manifest link, theme-color, apple-mobile-web-app tags
- `src/services/offlineStorage.ts` - localStorage caching and sync queue
- `src/hooks/useOnlineStatus.tsx` - online/offline detection
- `src/hooks/useWakeLock.ts` - screen wake lock
- `src/components/ConnectionStatusBar.tsx` - offline/sync indicator
- `src/components/ActiveRound.tsx` - already has `beforeunload` guard (line 48-52)
- `src/App.tsx` - already has sync queue processing on reconnect (lines 88-115)
- Service worker registration in `src/main.tsx`
- Icons `public/icon-192.png` and `public/icon-512.png` already exist

### Changes

**1. Improve Service Worker (`public/sw.js`)**

Replace the current basic cache-first strategy with stale-while-revalidate:
- On install: precache the app shell (`/`, `/index.html`)
- On fetch: serve from cache immediately, then update cache from network in the background
- Exclude all external API calls (Supabase REST/auth/functions, golfcourseapi, any non-same-origin request)
- On activate: delete old caches, call `self.clients.claim()`
- Use `self.skipWaiting()` on install

**2. Update Manifest (`public/manifest.json`)**

Update colors and add description/orientation fields per your specification:
- `theme_color`: `"#16a34a"` 
- `background_color`: `"#0f172a"`
- Add `"description"` and `"orientation": "portrait"`

**3. Update index.html**

- Update `theme-color` meta tag to `#16a34a`
- Add `apple-mobile-web-app-status-bar-style` meta tag with `black-translucent`

**4. Round Recovery on App Load (`src/App.tsx`)**

Add startup logic inside `AppContent`:
- On mount, check `offlineStorage.getCachedRound()`
- If an ACTIVE round is cached and less than 24 hours old: auto-restore it as the current round and navigate to `/active` with a "Resuming your round..." toast
- If cached round is older than 24 hours: show an AlertDialog asking "Resume or Discard?"
- If no cached round: proceed normally
- Also cache the active round whenever `currentRound` changes (for both authenticated and unauthenticated users)

**5. Remove `optimizeDeps.force` from Vite Config (`vite.config.ts`)**

Remove the `optimizeDeps: { force: true }` block since it was a one-time cache fix.

### Files to Modify
1. `public/sw.js` - Rewrite with stale-while-revalidate strategy
2. `public/manifest.json` - Update colors, add description/orientation
3. `index.html` - Update theme-color, add apple status bar style
4. `src/App.tsx` - Add round recovery logic and round caching
5. `vite.config.ts` - Remove optimizeDeps.force

### Technical Details

The round recovery flow:

```text
App Mounts
    |
    v
Check offlineStorage.getCachedRound()
    |
    +-- No cached round --> Normal flow
    |
    +-- Cached round found (status === 'ACTIVE')
            |
            +-- < 24 hours old --> Auto-restore, navigate to /active, toast "Resuming your round..."
            |
            +-- >= 24 hours old --> Show dialog: "Resume or Discard?"
                    |
                    +-- Resume --> Restore round, navigate to /active
                    +-- Discard --> clearCachedRound(), normal flow
```

The service worker exclusion pattern will check that URLs are same-origin AND do not contain `/rest/`, `/auth/`, `/functions/`, or `golfcourseapi` before caching.
