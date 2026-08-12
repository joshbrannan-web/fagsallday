import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineStorage } from './offlineStorage';

const store = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
  configurable: true,
});

describe('offline score patch queue', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it('keeps independent player and hole score patches', () => {
    offlineStorage.addToSyncQueue({ roundId: 'round-1', type: 'scorePatch', data: { holeNumber: 1, playerId: '1', score: 5 } });
    offlineStorage.addToSyncQueue({ roundId: 'round-1', type: 'scorePatch', data: { holeNumber: 1, playerId: '2', score: 4 } });
    offlineStorage.addToSyncQueue({ roundId: 'round-1', type: 'scorePatch', data: { holeNumber: 2, playerId: '1', score: 3 } });

    expect(offlineStorage.getSyncQueue()).toHaveLength(3);
  });

  it('keeps only the newest score for the same round, hole, and player', () => {
    offlineStorage.addToSyncQueue({ roundId: 'round-1', type: 'scorePatch', data: { holeNumber: 1, playerId: '1', score: 6 } });
    offlineStorage.addToSyncQueue({ roundId: 'round-1', type: 'scorePatch', data: { holeNumber: 1, playerId: '1', score: 5 } });

    const queue = offlineStorage.getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].data.score).toBe(5);
  });
});