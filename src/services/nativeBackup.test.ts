import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKED_UP_KEYS, BACKUP_COMPLETE_KEY, LOCAL_MARKER_KEY, STALE_KEYS_KEY,
  _flushBackupWrites, _resetForTests, clearBackup, initNativeBackup, mergeForRestore, removeItem, saveItem,
  type BackupStore,
} from './nativeBackup';
import { offlineStorage } from './offlineStorage';
import { deleteUnsentScores, resetSavedData } from '@/lib/recoveryStorage';

// ── fakes ───────────────────────────────────────────────────────────────

function fakeLocal(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  let full = false;
  return {
    map,
    fill() { full = true; },
    free() { full = false; },
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { if (full) throw new Error('QuotaExceededError'); map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    clear: () => map.clear(),
  };
}

function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const calls: string[] = [];
  let hang = false;
  let failNextSet = false;
  const store: BackupStore & { map: Map<string, string>; calls: string[]; hang(): void; failNextSet(): void } = {
    map, calls,
    hang() { hang = true; },
    failNextSet() { failNextSet = true; },
    get: async k => { calls.push(`get ${k}`); if (hang) return new Promise<string | null>(() => {}); return map.get(k) ?? null; },
    set: async (k, v) => {
      calls.push(`set ${k}`);
      if (failNextSet) { failNextSet = false; throw new Error('write failed'); }
      map.set(k, v);
    },
    remove: async k => { calls.push(`remove ${k}`); map.delete(k); },
  };
  return store;
}

/** Realistic saved data, including a large round history. */
function realisticData(): Record<string, string> {
  const now = Date.now();
  const history = Array.from({ length: 150 }, (_, i) => ({
    id: `round-${i}`, course: { name: `Course ${i}`, holes: Array.from({ length: 18 }, (_, h) => ({ par: 4, number: h + 1 })) },
    scores: Object.fromEntries(Array.from({ length: 18 }, (_, h) => [h + 1, { p1: 4, p2: 5 }])), notes: 'ünïcödé ⛳ "quoted"',
  }));
  return {
    fg_sync_queue: JSON.stringify([
      { id: 'q1', roundId: 'r1', type: 'scorePatch', data: { holeNumber: 3, playerId: 'p1', score: 4 }, timestamp: now },
      { id: 'q2', roundId: 'r1', type: 'scorePatch', data: { holeNumber: 4, playerId: 'p1', score: 5 }, timestamp: now },
    ]),
    fg_tournament_sync_queue: JSON.stringify([{ id: 't1', tournamentGroupId: 'g', tournamentPlayerId: 'p', holeNumber: 1, grossScore: 4, timestamp: now, retryCount: 2 }]),
    fg_tournament_result_queue: JSON.stringify([{ id: 'tr1', tournamentGroupId: 'g', payload: [], timestamp: now, retryCount: 0 }]),
    fg_offline_round: JSON.stringify({ id: 'r1', status: 'ACTIVE', scores: { 1: { p1: 4 } } }),
    fg_offline_round_meta: JSON.stringify({ roundId: 'r1', cachedAt: now, serverUpdatedAt: null }),
    fg_current_round: JSON.stringify({ id: 'local-1', status: 'ACTIVE' }),
    fg_history: JSON.stringify(history),
    fg_saved_courses: JSON.stringify([{ id: 'c1', name: 'Pebble' }, { id: 'c2', name: 'Torrey' }]),
  };
}

const onlyBackedUp = (m: Map<string, string>) =>
  Object.fromEntries(Array.from(m.entries()).filter(([k]) => BACKED_UP_KEYS.includes(k)));

beforeEach(() => _resetForTests());
afterEach(() => vi.useRealTimers());

// ── tests ───────────────────────────────────────────────────────────────

describe('website', () => {
  it('never touches Preferences', async () => {
    const store = fakeStore();
    const local = fakeLocal();
    expect(await initNativeBackup({ isNative: false, store, local })).toBe('web');
    saveItem('fg_sync_queue', '[]', local);
    removeItem('fg_history', local);
    await _flushBackupWrites();
    expect(store.calls).toEqual([]);
    expect(local.map.get('fg_sync_queue')).toBe('[]');
  });
});

describe('first launch after the update (migration)', () => {
  it('copies all eight items into the backup, character for character, and deletes nothing', async () => {
    const data = realisticData();
    const local = fakeLocal({ ...data, fg_onboarding_complete: 'true' });
    const store = fakeStore();
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('first-backup');
    await _flushBackupWrites();
    expect(onlyBackedUp(store.map)).toEqual(data);
    expect(store.map.get(BACKUP_COMPLETE_KEY)).toBe('1');
    // localStorage untouched apart from the marker
    for (const [k, v] of Object.entries(data)) expect(local.map.get(k)).toBe(v);
    expect(local.map.get('fg_onboarding_complete')).toBe('true');
    expect(local.map.get(LOCAL_MARKER_KEY)).toBe('1');
  });

  it("doesn't make the app wait for the copy", async () => {
    const local = fakeLocal(realisticData());
    const store = fakeStore();
    let copied = false;
    const slowSet = store.set;
    store.set = async (k, v) => { await new Promise(r => setTimeout(r, 50)); copied = true; return slowSet(k, v); };
    await initNativeBackup({ isNative: true, store, local });
    expect(copied).toBe(false); // startup finished before any copy completed
    await _flushBackupWrites();
    expect(copied).toBe(true);
  });
});

describe('normal launch', () => {
  it('starts without waiting on Preferences at all', async () => {
    const local = fakeLocal({ ...realisticData(), [LOCAL_MARKER_KEY]: '1' });
    const store = fakeStore({ [BACKUP_COMPLETE_KEY]: '1' });
    store.hang(); // even a Preferences that never answers reads doesn't delay startup
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('normal');
    expect(store.calls.filter(c => c.startsWith('get'))).toEqual([]);
  });

  it('brings a stale backup up to date, including removing items that were cleared', async () => {
    const local = fakeLocal({ fg_sync_queue: '[{"id":"new"}]', [LOCAL_MARKER_KEY]: '1' });
    const store = fakeStore({ fg_sync_queue: '[{"id":"old"}]', fg_history: '[{"id":"gone"}]', [BACKUP_COMPLETE_KEY]: '1' });
    await initNativeBackup({ isNative: true, store, local });
    await _flushBackupWrites();
    expect(store.map.get('fg_sync_queue')).toBe('[{"id":"new"}]');
    expect(store.map.has('fg_history')).toBe(false);
  });
});

describe('iOS wipes the web view storage', () => {
  async function migrated(data = realisticData()) {
    const local = fakeLocal(data);
    const store = fakeStore();
    await initNativeBackup({ isNative: true, store, local });
    await _flushBackupWrites();
    return { local, store, data };
  }

  it('restores all eight items exactly before the app starts', async () => {
    const { local, store, data } = await migrated();
    local.clear(); // the wipe
    _resetForTests();
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('restored');
    expect(onlyBackedUp(local.map)).toEqual(data);
    expect(local.map.get(LOCAL_MARKER_KEY)).toBe('1');
  });

  it('keeps every change made after migration, through the real offlineStorage functions', async () => {
    const { local, store } = await migrated({});
    vi.stubGlobal('localStorage', local);
    offlineStorage.addToSyncQueue({ roundId: 'r9', type: 'scorePatch', data: { holeNumber: 7, playerId: 'p', score: 3 } });
    offlineStorage.addTournamentScore('g1', 'p1', 5, 4);
    offlineStorage.cacheRound({ id: 'r9', status: 'ACTIVE', scores: {} } as never);
    await _flushBackupWrites();
    const before = onlyBackedUp(local.map);
    local.clear();
    _resetForTests();
    await initNativeBackup({ isNative: true, store, local });
    expect(onlyBackedUp(local.map)).toEqual(before);
    expect(offlineStorage.getSyncQueue().map(i => i.roundId)).toEqual(['r9']);
    vi.unstubAllGlobals();
  });

  it('does not bring back a queue that was emptied after sending', async () => {
    const { local, store } = await migrated();
    removeItem('fg_sync_queue', local); // sent and cleared
    await _flushBackupWrites();
    local.clear();
    _resetForTests();
    await initNativeBackup({ isNative: true, store, local });
    expect(local.map.has('fg_sync_queue')).toBe(false);
  });
});

describe('a save cut short', () => {
  it('app closed before the backup write finished: localStorage still wins next launch', async () => {
    const local = fakeLocal({ [LOCAL_MARKER_KEY]: '1', fg_sync_queue: '[]' });
    const store = fakeStore({ [BACKUP_COMPLETE_KEY]: '1', fg_sync_queue: '[]' });
    await initNativeBackup({ isNative: true, store, local });
    await _flushBackupWrites();
    store.failNextSet(); // this backup write never lands
    saveItem('fg_sync_queue', '[{"id":"latest"}]', local);
    await _flushBackupWrites();
    expect(store.map.get('fg_sync_queue')).toBe('[]');
    _resetForTests(); // "relaunch"
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('normal');
    await _flushBackupWrites();
    expect(local.map.get('fg_sync_queue')).toBe('[{"id":"latest"}]');
    expect(store.map.get('fg_sync_queue')).toBe('[{"id":"latest"}]'); // backup caught up
  });

  it('phone full: the save still reaches the backup, and the backup copy wins next launch', async () => {
    const local = fakeLocal({ [LOCAL_MARKER_KEY]: '1', fg_history: '[{"id":"old"}]' });
    const store = fakeStore({ [BACKUP_COMPLETE_KEY]: '1', fg_history: '[{"id":"old"}]' });
    await initNativeBackup({ isNative: true, store, local });
    await _flushBackupWrites();
    local.fill();
    expect(() => saveItem('fg_history', '[{"id":"old"},{"id":"new"}]', local)).toThrow();
    await _flushBackupWrites();
    expect(store.map.get('fg_history')).toBe('[{"id":"old"},{"id":"new"}]');
    expect(local.map.has(LOCAL_MARKER_KEY)).toBe(false);
    expect(JSON.parse(store.map.get(STALE_KEYS_KEY)!)).toEqual(['fg_history']);
    local.free();
    _resetForTests();
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('restored');
    expect(local.map.get('fg_history')).toBe('[{"id":"old"},{"id":"new"}]');
    await _flushBackupWrites();
    expect(store.map.has(STALE_KEYS_KEY)).toBe(false);
  });
});

describe('Preferences not answering during a restore', () => {
  it('starts the app anyway, protects the backup, and merges everything next launch', async () => {
    vi.useFakeTimers();
    const store = fakeStore({
      [BACKUP_COMPLETE_KEY]: '1',
      fg_sync_queue: '[{"id":"from-before-wipe"}]',
      fg_history: '[{"id":"round-a"}]',
    });
    const local = fakeLocal(); // wiped
    store.hang();
    const pending = initNativeBackup({ isNative: true, store, local, timeoutMs: 3_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBe('restore-failed');
    vi.useRealTimers();

    // The player keeps going this session: a new score goes to localStorage only
    saveItem('fg_sync_queue', '[{"id":"entered-this-session"}]', local);
    await _flushBackupWrites();
    expect(store.map.get('fg_sync_queue')).toBe('[{"id":"from-before-wipe"}]'); // backup not overwritten

    // Next launch, Preferences works again: nothing from either side is lost
    _resetForTests();
    const working = fakeStore(Object.fromEntries(store.map));
    expect(await initNativeBackup({ isNative: true, store: working, local })).toBe('restored');
    expect(JSON.parse(local.map.get('fg_sync_queue')!).map((i: { id: string }) => i.id))
      .toEqual(['entered-this-session', 'from-before-wipe']);
    expect(local.map.get('fg_history')).toBe('[{"id":"round-a"}]');
  });
});

describe('deliberate deletions also clear the backup', () => {
  async function setUp() {
    const local = fakeLocal(realisticData());
    const store = fakeStore();
    await initNativeBackup({ isNative: true, store, local });
    await _flushBackupWrites();
    return { local, store };
  }

  it('account deletion: nothing is restored afterwards', async () => {
    const { local, store } = await setUp();
    Array.from(local.map.keys()).filter(k => k.startsWith('fg_')).forEach(k => local.map.delete(k)); // Profile.tsx
    await clearBackup();
    _resetForTests();
    expect(await initNativeBackup({ isNative: true, store, local })).toBe('first-backup');
    expect(onlyBackedUp(local.map)).toEqual({});
  });

  it('crash-screen reset and "delete unsent scores" clear the backup copies too', async () => {
    const { local, store } = await setUp();
    resetSavedData(local as never);
    await _flushBackupWrites();
    for (const k of ['fg_current_round', 'fg_history', 'fg_saved_courses', 'fg_offline_round', 'fg_offline_round_meta']) {
      expect(store.map.has(k)).toBe(false);
    }
    expect(store.map.has('fg_sync_queue')).toBe(true); // reset keeps unsent scores
    deleteUnsentScores(local as never);
    await _flushBackupWrites();
    expect(store.map.has('fg_sync_queue')).toBe(false);
  });
});

describe('mergeForRestore', () => {
  it('unions queue items by id, keeping the local copy of shared items', () => {
    expect(JSON.parse(mergeForRestore('fg_sync_queue', '[{"id":"a","v":2}]', '[{"id":"a","v":1},{"id":"b"}]')!))
      .toEqual([{ id: 'a', v: 2 }, { id: 'b' }]);
  });
  it('keeps the local value for other items, unless it is marked out of date', () => {
    expect(mergeForRestore('fg_history', 'L', 'B')).toBe('L');
    expect(mergeForRestore('fg_history', 'L', 'B', true)).toBe('B');
    expect(mergeForRestore('fg_history', null, 'B')).toBe('B');
    expect(mergeForRestore('fg_history', 'L', null)).toBe('L');
  });
});
