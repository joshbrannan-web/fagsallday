import { describe, expect, it, vi } from 'vitest';
import { setupServiceWorker } from './serviceWorker';

function fakeBrowser(existing = 1, cacheNames = ['golf-app-v5']) {
  const unregistered: number[] = [];
  const deleted: string[] = [];
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
  const nav = {
    serviceWorker: {
      register,
      getRegistrations: async () =>
        Array.from({ length: existing }, (_, i) => ({ unregister: async () => { unregistered.push(i); return true; } })) as never,
    },
  };
  const cachesApi = {
    keys: async () => cacheNames,
    delete: async (name: string) => { deleted.push(name); return true; },
  };
  return { nav, cachesApi, register, unregistered, deleted };
}
const flush = () => new Promise(r => setTimeout(r, 0));

describe('service worker setup', () => {
  it('website, production: registers /sw.js exactly as before and clears nothing', async () => {
    const b = fakeBrowser();
    expect(setupServiceWorker({ isNative: false, isProd: true, nav: b.nav, cachesApi: b.cachesApi })).toBe('registered');
    await flush();
    expect(b.register).toHaveBeenCalledWith('/sw.js');
    expect(b.unregistered).toEqual([]);
    expect(b.deleted).toEqual([]);
  });

  it('website, development: removes service workers and caches as before', async () => {
    const b = fakeBrowser(2, ['a', 'b']);
    expect(setupServiceWorker({ isNative: false, isProd: false, nav: b.nav, cachesApi: b.cachesApi })).toBe('cleaned');
    await flush();
    expect(b.register).not.toHaveBeenCalled();
    expect(b.unregistered).toEqual([0, 1]);
    expect(b.deleted).toEqual(['a', 'b']);
  });

  it('iOS app: never registers, and removes anything left over', async () => {
    const b = fakeBrowser(1, ['golf-app-v5']);
    expect(setupServiceWorker({ isNative: true, isProd: true, nav: b.nav, cachesApi: b.cachesApi })).toBe('cleaned');
    await flush();
    expect(b.register).not.toHaveBeenCalled();
    expect(b.unregistered).toEqual([0]);
    expect(b.deleted).toEqual(['golf-app-v5']);
  });

  it('iOS app without service worker support (the normal case): does nothing', () => {
    expect(setupServiceWorker({ isNative: true, isProd: true, nav: {}, cachesApi: undefined })).toBe('unsupported');
  });

  it('a failing clean-up never throws', async () => {
    const nav = { serviceWorker: { register: vi.fn(), getRegistrations: () => Promise.reject(new Error('no')) } };
    const cachesApi = { keys: () => Promise.reject(new Error('no')), delete: vi.fn() };
    expect(() => setupServiceWorker({ isNative: true, isProd: true, nav: nav as never, cachesApi: cachesApi as never })).not.toThrow();
    await flush();
  });
});
