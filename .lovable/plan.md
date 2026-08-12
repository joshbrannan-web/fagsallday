# Force new app shell to take over on reopen

Returning phones can run an old bundle because the service worker serves a precached shell. Two small changes fix this.

## Changes

1. `public/sw.js` — bump `CACHE_NAME` from `'golf-app-v2'` to `'golf-app-v3'`. The existing activate handler deletes any cache whose name differs, and the worker already calls `skipWaiting()` and `clients.claim()`, so the stale precached shell is dropped on the next load. Bump again on future app-shell/index.html changes.

2. New `public/_headers` (Cloudflare Pages) so the worker script and shell are never served stale:

```text
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, must-revalidate
```

`/assets/*` is intentionally untouched — those filenames are content-hashed and stay immutable.

## Notes

No app logic, scoring, or backend changes. Effect is only visible after the next deploy to Cloudflare Pages.
