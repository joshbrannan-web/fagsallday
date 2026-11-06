// The website's offline cache (public/sw.js).
//
// Website, production build: register it, as before.
// Development build: remove any service worker and cached files, as before (a service
//   worker must never cache Vite's development modules).
// iOS app: never register it. The app's files already ship inside the app, iOS doesn't
//   run service workers for Capacitor's capacitor:// pages, and a stale cache could serve
//   old files. Remove anything left over, just in case the setup ever changes.

type SwNavigator = { serviceWorker?: Pick<ServiceWorkerContainer, 'register' | 'getRegistrations'> };
type CacheApi = Pick<CacheStorage, 'keys' | 'delete'> | undefined;

export type ServiceWorkerOutcome = 'registered' | 'cleaned' | 'unsupported';

export function setupServiceWorker(opts: {
  isNative: boolean;
  isProd: boolean;
  nav?: SwNavigator;
  cachesApi?: CacheApi;
}): ServiceWorkerOutcome {
  const nav = opts.nav ?? (navigator as SwNavigator);
  const cachesApi = opts.cachesApi ?? (typeof caches === 'undefined' ? undefined : caches);
  if (!nav.serviceWorker) return 'unsupported';

  if (opts.isProd && !opts.isNative) {
    nav.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed - app still works without it
    });
    return 'registered';
  }

  void nav.serviceWorker
    .getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(() => {});
  if (cachesApi) {
    void cachesApi
      .keys()
      .then(names => Promise.all(names.map(name => cachesApi.delete(name))))
      .catch(() => {});
  }
  return 'cleaned';
}
