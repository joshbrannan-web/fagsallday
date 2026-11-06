// Native backup of the data that must never be lost (unsent scores, the saved active
// round, and signed-out players' only copy of their rounds and courses).
//
// Inside the iOS app, the web view's localStorage can be wiped by iOS when the device is
// low on storage. The app keeps reading and writing localStorage exactly as before (it
// needs instant, synchronous reads), and every change to one of these items is also
// copied to Capacitor Preferences (iOS UserDefaults), which iOS does not clear for space.
//
// A marker in localStorage tells the two situations apart at startup:
//   marker present → localStorage is intact and is the source of truth; the backup is
//                    refreshed in the background. The app starts immediately.
//   marker missing, backup complete → iOS wiped localStorage: restore it from the backup
//                    before the app starts.
//   marker missing, no backup yet → first launch with this code: copy localStorage into
//                    the backup in the background. The app starts immediately.
//
// On the website none of this runs: localStorage is used exactly as before.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const BACKED_UP_KEYS = [
  'fg_sync_queue',
  'fg_tournament_sync_queue',
  'fg_tournament_result_queue',
  'fg_offline_round',
  'fg_offline_round_meta',
  'fg_current_round',
  'fg_history',
  'fg_saved_courses',
];

/** In localStorage: "localStorage is intact and up to date". */
export const LOCAL_MARKER_KEY = 'fg_native_backup_marker';
/** In the backup: "a complete copy has been made at least once". */
export const BACKUP_COMPLETE_KEY = 'fg_native_backup_complete';
/** In the backup: items whose localStorage copy is out of date because a save to it failed. */
export const STALE_KEYS_KEY = 'fg_native_backup_stale';
/** Longest the app waits to restore after a wipe before starting anyway. */
export const RESTORE_TIMEOUT_MS = 10_000;

export interface BackupStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

type Local = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const preferencesStore: BackupStore = {
  get: async key => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
  remove: key => Preferences.remove({ key }),
};

/** The active backup, or null on the web (or if the backup was switched off for safety). */
let backup: BackupStore | null = null;
/** Backup writes run one at a time, in the order they were made. */
let chain: Promise<void> = Promise.resolve();
/** Items whose last save reached the backup but not localStorage (e.g. the phone was full). */
const staleKeys = new Set<string>();

function recordStale(key: string, stale: boolean) {
  if (stale === staleKeys.has(key)) return;
  if (stale) staleKeys.add(key);
  else staleKeys.delete(key);
  const list = JSON.stringify(Array.from(staleKeys));
  void enqueue(store => store.set(STALE_KEYS_KEY, list));
}

const isBackedUp = (key: string) => BACKED_UP_KEYS.includes(key);

/** Lists of unsent items, each with a unique id: safe to merge rather than replace. */
const QUEUE_KEYS = ['fg_sync_queue', 'fg_tournament_sync_queue', 'fg_tournament_result_queue'];

/**
 * Combine what localStorage has with what the backup has, without dropping anything:
 * for the score queues, every item from both (matched by id, localStorage's copy wins);
 * for everything else, localStorage's value if it has one, otherwise the backup's.
 */
export function mergeForRestore(
  key: string,
  localValue: string | null,
  backupValue: string | null,
  localIsStale = false,
): string | null {
  if (backupValue === null) return localValue;
  if (localValue === null) return backupValue;
  if (!QUEUE_KEYS.includes(key)) return localIsStale ? backupValue : localValue;
  try {
    const localItems = JSON.parse(localValue);
    const backupItems = JSON.parse(backupValue);
    if (!Array.isArray(localItems) || !Array.isArray(backupItems)) return localValue;
    const ids = new Set(localItems.map((item: { id?: unknown }) => item?.id));
    const extra = backupItems.filter((item: { id?: unknown }) => item?.id === undefined || !ids.has(item.id));
    return extra.length === 0 ? localValue : JSON.stringify([...localItems, ...extra]);
  } catch {
    return localValue;
  }
}

function enqueue(op: (store: BackupStore) => Promise<void>): Promise<void> {
  const store = backup;
  if (!store) return chain;
  chain = chain.then(() => op(store)).catch(error => console.warn('Native backup write failed', error));
  return chain;
}

function localOrNull(): Local | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function dropMarker(local: Local | null) {
  try {
    local?.removeItem(LOCAL_MARKER_KEY);
  } catch {
    /* nothing more we can do */
  }
}

/**
 * Save one of the app's items. Writes localStorage as before and, inside the iOS app,
 * the backup too. Throws if localStorage refuses the write (as localStorage.setItem did),
 * after making sure the backup still gets the value and the next launch trusts the backup.
 */
export function saveItem(key: string, value: string, local: Local | null = localOrNull()): void {
  if (isBackedUp(key)) void enqueue(store => store.set(key, value));
  try {
    if (!local) throw new Error('localStorage unavailable');
    local.setItem(key, value);
  } catch (error) {
    // localStorage is now behind the backup for this item: note that in the backup (local
    // storage may be full) and make the next launch restore from the backup.
    if (isBackedUp(key) && backup) {
      recordStale(key, true);
      dropMarker(local);
    }
    throw error;
  }
  if (isBackedUp(key) && backup) recordStale(key, false);
}

/** Remove one of the app's items, from localStorage and (inside the iOS app) the backup. Never throws. */
export function removeItem(key: string, local: Local | null = localOrNull()): void {
  if (isBackedUp(key)) void enqueue(store => store.remove(key));
  try {
    local?.removeItem(key);
  } catch {
    /* removal can't usefully fail */
  }
  if (isBackedUp(key) && backup) recordStale(key, false);
}

/** Account deletion: remove every backed-up item and the backup's completion flag. */
export function clearBackup(): Promise<void> {
  BACKED_UP_KEYS.forEach(key => void enqueue(store => store.remove(key)));
  staleKeys.clear();
  void enqueue(store => store.remove(STALE_KEYS_KEY));
  return enqueue(store => store.remove(BACKUP_COMPLETE_KEY));
}

/** Copy localStorage into the backup. `mirrorRemovals`: also delete items localStorage no longer has. */
function copyLocalToBackup(local: Local, mirrorRemovals: boolean): Promise<void> {
  for (const key of BACKED_UP_KEYS) {
    let value: string | null = null;
    try {
      value = local.getItem(key);
    } catch {
      continue;
    }
    if (value !== null) void enqueue(store => store.set(key, value as string));
    else if (mirrorRemovals) void enqueue(store => store.remove(key));
  }
  return enqueue(store => store.set(BACKUP_COMPLETE_KEY, '1'));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

export type StartupOutcome = 'web' | 'normal' | 'first-backup' | 'restored' | 'restore-failed' | 'no-local-storage';

/**
 * Run before the app starts. On the website it does nothing. Inside the iOS app it only
 * waits when localStorage was wiped and has to be restored.
 */
export async function initNativeBackup(opts: {
  isNative?: boolean;
  store?: BackupStore;
  local?: Local | null;
  timeoutMs?: number;
} = {}): Promise<StartupOutcome> {
  const isNative = opts.isNative ?? safeIsNative();
  if (!isNative) return 'web';
  const store = opts.store ?? preferencesStore;
  const local = opts.local === undefined ? localOrNull() : opts.local;
  const timeoutMs = opts.timeoutMs ?? RESTORE_TIMEOUT_MS;
  backup = store;
  if (!local) return 'no-local-storage';

  let markerPresent = false;
  try {
    markerPresent = local.getItem(LOCAL_MARKER_KEY) !== null;
  } catch {
    markerPresent = false;
  }

  if (markerPresent) {
    // Normal launch: localStorage is the source of truth. Bring the backup fully up to date
    // (covers a write cut short last time), without making the app wait.
    void copyLocalToBackup(local, true);
    return 'normal';
  }

  let backupComplete: string | null = null;
  try {
    backupComplete = await withTimeout(store.get(BACKUP_COMPLETE_KEY), timeoutMs);
  } catch {
    return disableForSession();
  }

  if (backupComplete === null) {
    // First launch with this code: make the first copy. Only copies, never deletes, so a
    // partial earlier copy is never thrown away.
    void copyLocalToBackup(local, false);
    trySet(local, LOCAL_MARKER_KEY, '1');
    return 'first-backup';
  }

  // localStorage was wiped: put everything back before the app reads it.
  let values: (string | null)[];
  let stale = new Set<string>();
  try {
    const [staleRaw, ...rest] = await withTimeout(
      Promise.all([store.get(STALE_KEYS_KEY), ...BACKED_UP_KEYS.map(key => store.get(key))]),
      timeoutMs,
    );
    values = rest;
    try {
      const parsed = staleRaw ? JSON.parse(staleRaw) : [];
      if (Array.isArray(parsed)) stale = new Set(parsed.filter((k): k is string => typeof k === 'string'));
    } catch {
      /* treat as none */
    }
  } catch {
    return disableForSession();
  }
  // Never overwrite something localStorage already has; merge the score queues.
  let allRestored = true;
  BACKED_UP_KEYS.forEach((key, i) => {
    let current: string | null = null;
    try {
      current = local.getItem(key);
    } catch {
      current = null;
    }
    const merged = mergeForRestore(key, current, values[i], stale.has(key));
    if (merged !== null && merged !== current) {
      if (!trySet(local, key, merged)) allRestored = false;
      else void enqueue(store => store.set(key, merged));
    }
  });
  // Only call localStorage intact once everything is back; otherwise retry next launch.
  if (allRestored) {
    trySet(local, LOCAL_MARKER_KEY, '1');
    void enqueue(store => store.remove(STALE_KEYS_KEY));
  }
  return 'restored';
}

/**
 * The backup couldn't be read. Start the app with what localStorage has, but stop writing
 * to the backup for this session so it can't be overwritten with less data; the next
 * launch tries the restore again (the marker is still missing).
 */
function disableForSession(): StartupOutcome {
  backup = null;
  return 'restore-failed';
}

function trySet(local: Local, key: string, value: string): boolean {
  try {
    local.setItem(key, value);
    return true;
  } catch {
    return false; // the app still starts; the marker stays missing so the next launch retries
  }
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** For tests: wait for queued backup writes, and reset module state. */
export function _flushBackupWrites(): Promise<void> {
  return chain;
}
export function _resetForTests(): void {
  backup = null;
  chain = Promise.resolve();
  staleKeys.clear();
}
