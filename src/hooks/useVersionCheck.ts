import { useEffect } from 'react';

declare const __APP_BUILD_HASH__: string;

const BUILD_HASH_KEY = 'fg_build_hash';

// Records the current build. An app update must never sign the user out or
// clear local data — in particular the offline sync queue, which has to
// survive updates and keep retrying until its scores reach the server.
export function useVersionCheck() {
  useEffect(() => {
    if (localStorage.getItem(BUILD_HASH_KEY) !== __APP_BUILD_HASH__) {
      localStorage.setItem(BUILD_HASH_KEY, __APP_BUILD_HASH__);
    }
  }, []);
}
