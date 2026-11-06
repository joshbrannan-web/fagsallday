// What the crash screen can safely inspect and clear on this phone.
//
// Every function here is written so it cannot throw: the crash screen calls them
// while the app is already broken, and they must still return something useful
// even if storage is unavailable or its contents are damaged.

import { removeItem } from '@/services/nativeBackup';

/** Scores waiting to reach the server. Only ever removed by deleteUnsentScores(). */
export const UNSENT_QUEUE_KEYS = ['fg_sync_queue', 'fg_tournament_sync_queue', 'fg_tournament_result_queue'];

/**
 * Written only while the player is NOT signed in, so their contents exist only on
 * this phone. (Signed-in players use the server; signing in doesn't upload these.)
 */
const PHONE_ONLY_KEYS = { currentRound: 'fg_current_round', history: 'fg_history', courses: 'fg_saved_courses' };

/** Copies of server data that the app reloads on its own. */
const CACHE_KEYS = ['fg_offline_round', 'fg_offline_round_meta'];
const CACHE_PREFIXES = ['fg_tournament_scoreboards_'];

/** Everything "Reset saved data" clears. Never includes the unsent-score queues or sign-in. */
const RESET_KEYS = [...Object.values(PHONE_ONLY_KEYS), ...CACHE_KEYS];

/** The shape each key must have, used to spot damaged data. */
const EXPECTED: Record<string, 'array' | 'object'> = {
  fg_current_round: 'object',
  fg_history: 'array',
  fg_saved_courses: 'array',
  fg_offline_round: 'object',
  fg_offline_round_meta: 'object',
};

const RECOVERY_FLAG = 'fg_recovery_reset_at';
const RECOVERY_FLAG_MS = 10 * 60 * 1000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function remove(storage: Storage | null, key: string): void {
  // Also removes the iOS app's backup copy, so cleared data can't be restored later.
  removeItem(key, storage);
}

function allKeys(storage: Storage | null): string[] {
  const keys: string[] = [];
  try {
    if (!storage) return keys;
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
  } catch {
    /* return what we have */
  }
  return keys;
}

/** Parsed value, or `undefined` if missing, or the string 'damaged' if unreadable. */
function parse(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return 'damaged';
  }
}

/** True when a stored value holds something (not empty, null or "[]"). */
function hasContent(raw: string | null): boolean {
  if (raw === null) return false;
  const t = raw.trim();
  return t !== '' && t !== 'null' && t !== '[]' && t !== '{}';
}

export interface SavedDataSnapshot {
  /** Number of unsent scores, or null if a queue couldn't be read. */
  unsentCount: number | null;
  /** True if any queue holds anything, even when it couldn't be counted. */
  hasUnsent: boolean;
  /** Rounds and courses that exist only on this phone. Counts are null when unreadable. */
  phoneOnly: { hasData: boolean; rounds: number | null; courses: number | null };
  /** A sign-in session is stored on this phone. */
  signedIn: boolean;
  /** Keys whose contents the app can no longer read. Never includes the unsent-score queues. */
  damagedKeys: string[];
  /** "Reset saved data" was used in the last few minutes (and the app crashed again). */
  resetRecentlyTried: boolean;
}

/** Look at what's saved on this phone. Never throws. */
export function inspectSavedData(storage: Storage | null = safeLocalStorage()): SavedDataSnapshot {
  const snapshot: SavedDataSnapshot = {
    unsentCount: 0,
    hasUnsent: false,
    phoneOnly: { hasData: false, rounds: 0, courses: 0 },
    signedIn: false,
    damagedKeys: [],
    resetRecentlyTried: false,
  };

  try {
    for (const key of UNSENT_QUEUE_KEYS) {
      const raw = read(storage, key);
      if (!hasContent(raw)) continue;
      snapshot.hasUnsent = true;
      const value = parse(raw);
      if (Array.isArray(value) && snapshot.unsentCount !== null) snapshot.unsentCount += value.length;
      else snapshot.unsentCount = null;
    }
  } catch {
    snapshot.unsentCount = null;
  }

  try {
    // Read strictly here: if storage can't be read at all, fall into the catch below and
    // assume there is phone-only data, so the player sees the stronger warning.
    if (!storage) throw new Error('storage unavailable');
    const historyRaw = storage.getItem(PHONE_ONLY_KEYS.history);
    const coursesRaw = storage.getItem(PHONE_ONLY_KEYS.courses);
    const currentRaw = storage.getItem(PHONE_ONLY_KEYS.currentRound);
    const history = parse(historyRaw);
    const courses = parse(coursesRaw);
    const current = parse(currentRaw);
    // Only readable, correctly shaped data counts as something a reset would lose:
    // unreadable data can't be shown by the app anyway.
    snapshot.phoneOnly = {
      hasData:
        (Array.isArray(history) && history.length > 0) ||
        (Array.isArray(courses) && courses.length > 0) ||
        (!!current && typeof current === 'object' && !Array.isArray(current) && hasContent(currentRaw)),
      rounds: Array.isArray(history) ? history.length : hasContent(historyRaw) ? null : 0,
      courses: Array.isArray(courses) ? courses.length : hasContent(coursesRaw) ? null : 0,
    };
  } catch {
    // When unsure, assume there is phone-only data so the stronger warning is shown.
    snapshot.phoneOnly = { hasData: true, rounds: null, courses: null };
  }

  try {
    snapshot.signedIn = allKeys(storage).some(key => {
      if (!/^sb-.+-auth-token$/.test(key)) return false;
      const session = parse(read(storage, key)) as { access_token?: unknown; refresh_token?: unknown } | undefined;
      return !!session && typeof session === 'object' && !!(session.refresh_token || session.access_token);
    });
  } catch {
    snapshot.signedIn = false;
  }

  try {
    const keysToCheck = [
      ...Object.keys(EXPECTED),
      ...allKeys(storage).filter(k => CACHE_PREFIXES.some(p => k.startsWith(p))),
    ];
    for (const key of keysToCheck) {
      const raw = read(storage, key);
      if (raw === null) continue;
      const value = parse(raw);
      const expected = EXPECTED[key];
      const damaged =
        value === 'damaged' ||
        (expected === 'array' && !Array.isArray(value)) ||
        (expected === 'object' && value !== null && (typeof value !== 'object' || Array.isArray(value)));
      if (damaged) snapshot.damagedKeys.push(key);
    }
  } catch {
    /* leave what was found */
  }

  try {
    const at = Number(sessionStorageOrNull()?.getItem(RECOVERY_FLAG));
    snapshot.resetRecentlyTried = Number.isFinite(at) && at > 0 && Date.now() - at < RECOVERY_FLAG_MS;
  } catch {
    snapshot.resetRecentlyTried = false;
  }

  return snapshot;
}

/** Remove only the damaged keys found by inspectSavedData. Never touches the unsent-score queues. */
export function removeDamagedData(keys: string[], storage: Storage | null = safeLocalStorage()): void {
  keys.filter(k => !UNSENT_QUEUE_KEYS.includes(k)).forEach(k => remove(storage, k));
}

/**
 * "Reset saved data": clears the saved round, history, courses and cached copies.
 * Keeps unsent scores, sign-in, and small settings. Never throws.
 */
export function resetSavedData(storage: Storage | null = safeLocalStorage()): void {
  RESET_KEYS.forEach(k => remove(storage, k));
  allKeys(storage)
    .filter(k => CACHE_PREFIXES.some(p => k.startsWith(p)))
    .forEach(k => remove(storage, k));
  try {
    sessionStorageOrNull()?.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    /* only affects whether the last-resort option is offered */
  }
}

/** Delete scores that haven't reached the server. Only on the player's explicit choice. */
export function deleteUnsentScores(storage: Storage | null = safeLocalStorage()): void {
  UNSENT_QUEUE_KEYS.forEach(k => remove(storage, k));
}

function sessionStorageOrNull(): Pick<globalThis.Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
