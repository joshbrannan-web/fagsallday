import { beforeEach, describe, expect, it } from 'vitest';
import { deleteUnsentScores, inspectSavedData, removeDamagedData, resetSavedData, UNSENT_QUEUE_KEYS } from './recoveryStorage';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

const queues = {
  fg_sync_queue: JSON.stringify([{ id: '1' }, { id: '2' }]),
  fg_tournament_sync_queue: JSON.stringify([{ id: '3' }]),
  fg_tournament_result_queue: JSON.stringify([]),
};
const session = { 'sb-abc-auth-token': JSON.stringify({ access_token: 'a', refresh_token: 'r' }) };

describe('resetSavedData', () => {
  it('clears saved rounds, history, courses and caches but keeps unsent scores, sign-in and settings', () => {
    const s = fakeStorage({
      ...queues, ...session,
      fg_current_round: '{}', fg_history: '[]', fg_saved_courses: '[]',
      fg_offline_round: '{}', fg_offline_round_meta: '{}', fg_tournament_scoreboards_t1: '{}',
      fg_onboarding_complete: 'true', fg_whats_new_seen: 'v3',
    });
    resetSavedData(s);
    expect(Array.from(s.map.keys()).sort()).toEqual(
      [...UNSENT_QUEUE_KEYS, 'sb-abc-auth-token', 'fg_onboarding_complete', 'fg_whats_new_seen'].sort(),
    );
    expect(s.map.get('fg_sync_queue')).toBe(queues.fg_sync_queue);
  });

  it('never throws, even when storage does', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); },
      removeItem: () => { throw new Error('x'); }, key: () => { throw new Error('x'); }, get length(): number { throw new Error('x'); } };
    expect(() => resetSavedData(broken)).not.toThrow();
    expect(() => deleteUnsentScores(broken)).not.toThrow();
    expect(() => removeDamagedData(['fg_history'], broken)).not.toThrow();
  });
});

describe('removeDamagedData', () => {
  it('never removes the unsent-score queues, even if asked to', () => {
    const s = fakeStorage({ ...queues, fg_history: '{bad' });
    removeDamagedData(['fg_history', 'fg_sync_queue'], s);
    expect(s.map.has('fg_history')).toBe(false);
    expect(s.map.get('fg_sync_queue')).toBe(queues.fg_sync_queue);
  });
});

describe('deleteUnsentScores', () => {
  it('removes only the queues', () => {
    const s = fakeStorage({ ...queues, fg_history: '[1]' });
    deleteUnsentScores(s);
    expect(Array.from(s.map.keys())).toEqual(['fg_history']);
  });
});

describe('inspectSavedData', () => {
  beforeEach(() => { /* each test passes its own storage */ });

  it('counts unsent scores across all queues', () => {
    const d = inspectSavedData(fakeStorage(queues));
    expect(d.unsentCount).toBe(3);
    expect(d.hasUnsent).toBe(true);
  });

  it('reports phone-only rounds and courses with counts', () => {
    const d = inspectSavedData(fakeStorage({ fg_history: '[{},{}]', fg_saved_courses: '[{}]' }));
    expect(d.phoneOnly).toEqual({ hasData: true, rounds: 2, courses: 1 });
    expect(d.signedIn).toBe(false);
  });

  it('treats unreadable history as damaged, not as data a reset would lose', () => {
    const d = inspectSavedData(fakeStorage({ fg_history: '{not json' }));
    expect(d.phoneOnly.hasData).toBe(false);
    expect(d.phoneOnly.rounds).toBeNull();
    expect(d.damagedKeys).toEqual(['fg_history']);
  });

  it('still counts readable history when another item is damaged', () => {
    const d = inspectSavedData(fakeStorage({ fg_history: '[{}]', fg_current_round: '{broken' }));
    expect(d.phoneOnly).toEqual({ hasData: true, rounds: 1, courses: 0 });
  });

  it('flags data with the wrong shape as damaged', () => {
    const d = inspectSavedData(fakeStorage({ fg_saved_courses: '{"not":"a list"}', fg_current_round: '[1]' }));
    expect(d.damagedKeys.sort()).toEqual(['fg_current_round', 'fg_saved_courses']);
  });

  it('detects a stored sign-in session', () => {
    expect(inspectSavedData(fakeStorage(session)).signedIn).toBe(true);
    expect(inspectSavedData(fakeStorage({ 'sb-abc-auth-token': 'null' })).signedIn).toBe(false);
  });

  it('assumes the worst when storage is unavailable, and never throws', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => {}, removeItem: () => {},
      key: () => null, get length(): number { throw new Error('x'); } };
    const d = inspectSavedData(broken);
    expect(d.phoneOnly).toEqual({ hasData: true, rounds: null, courses: null });
    expect(inspectSavedData(null).phoneOnly.hasData).toBe(true);
    expect(d.signedIn).toBe(false);
    expect(d.damagedKeys).toEqual([]);
  });
});
