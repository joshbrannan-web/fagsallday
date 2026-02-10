

## Offline Mode and Refresh Protection for Golf App

### Overview
Add full PWA support, wake lock, refresh protection, and connection status so the app stays active and functional throughout an entire round -- even without internet or if the user accidentally refreshes.

### What Already Exists
- Offline storage with localStorage caching (`offlineStorage.ts`)
- Sync queue for pending changes when offline
- `useOnlineStatus` hook for detecting connectivity
- Optimistic updates in `useRounds` that work without network
- WifiOff/Cloud icons already imported in ActiveRound.tsx

### New Files to Create

**1. `public/manifest.json`** -- Web App Manifest
- name: "Golf Betting App", short_name: "GolfBets"
- display: "standalone"
- theme_color: "#339E8F" (matches the app's teal primary)
- background_color: "#FAF8F5" (matches --background)
- start_url: "/"
- Placeholder 192x192 and 512x512 icon entries (using existing favicon initially)

**2. `public/sw.js`** -- Service Worker
- Cache-first strategy for app shell (HTML, CSS, JS, images)
- On install: pre-cache all critical assets
- On fetch: serve from cache first, fall back to network
- On activate: clean up old caches
- Versioned cache name for easy updates

**3. `src/hooks/useWakeLock.ts`** -- Wake Lock Hook
- Request wake lock when called with `enabled=true`
- Release on cleanup or when `enabled=false`
- Re-acquire on `visibilitychange` (when user returns to app)
- Gracefully handle unsupported browsers (just returns `isSupported: false`)
- Expose `isActive` state for UI indicator

**4. `src/components/ConnectionStatusBar.tsx`** -- Connection Status Indicator
- Small, non-intrusive bar/icon overlay
- Shows "Offline" with WifiOff icon when disconnected
- Briefly flashes "Back online" with animation when reconnecting, then auto-hides
- Shows sync count badge when there are pending items
- Renders at the top of the screen, does not interfere with content

### Files to Modify

**5. `index.html`**
- Add `<link rel="manifest" href="/manifest.json">`
- Add `<meta name="theme-color" content="#339E8F">`
- Add `<meta name="apple-mobile-web-app-capable" content="yes">`

**6. `src/main.tsx`**
- Register service worker on app load: `navigator.serviceWorker?.register('/sw.js')`

**7. `src/components/ActiveRound.tsx`**
- Add `beforeunload` event listener (refresh/close guard) -- only active while this component is mounted
- Add `useWakeLock(true)` to keep screen on during active round
- Show small green dot/icon when wake lock is active (next to the existing offline indicators)

**8. `src/App.tsx`**
- Add `ConnectionStatusBar` component above the routes
- No changes to existing round persistence logic (it already saves to localStorage and syncs)

### What Is NOT Needed (Already Handled)
- Round state persistence: The app already caches the active round to localStorage via `offlineStorage.cacheRound()` and restores it via `useRounds`. No new `useRoundPersistence` hook is needed -- the existing system already covers this.
- Stale round detection (24h+): Not needed for initial implementation since the existing system auto-restores the active round from the database on reload. The localStorage cache is a fallback for offline scenarios.
- "Resuming your round..." toast: Can be added as a simple toast in the existing sync flow in App.tsx when a cached round is detected.

### Technical Details

**Service Worker (sw.js)**
```javascript
const CACHE_NAME = 'golf-app-v1';
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first for same-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
```

**Wake Lock Hook**
```typescript
// Requests Screen Wake Lock API
// Re-acquires on visibilitychange
// Returns { isActive, isSupported }
```

**beforeunload Guard (in ActiveRound.tsx)**
```typescript
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, []);
```

**ConnectionStatusBar**
- Uses existing `useOnlineStatus` hook
- Shows/hides with CSS transitions
- "Back online" message auto-dismisses after 3 seconds
- Positioned as a fixed bar at the very top of the viewport

### Button/UI Placement
- Wake lock indicator: small green "screen on" icon in the ActiveRound header area, near the hole number
- Connection status: fixed position top bar, overlays content briefly when state changes
- No changes to button layouts on other pages

