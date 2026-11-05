import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineStorage, isTournamentRetryDue } from './offlineStorage';

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
describe('tournament queue retries', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it('measures the retry wait from the last attempt, not from entry', () => {
    const entered = 1_000_000_000;
    // Entered long ago, but just failed for the 5th time: must wait 5 minutes from that failure
    const item = { timestamp: entered, retryCount: 5, lastAttempt: entered + 3_600_000 };
    expect(isTournamentRetryDue(item, entered + 3_600_000 + 60_000)).toBe(false);
    expect(isTournamentRetryDue(item, entered + 3_600_000 + 300_000)).toBe(true);
  });

  it('falls back to entry time for items queued before lastAttempt existed', () => {
    const item = { timestamp: 0, retryCount: 0 };
    expect(isTournamentRetryDue(item, 29_000)).toBe(false);
    expect(isTournamentRetryDue(item, 30_000)).toBe(true);
  });

  it('records the time of each failed attempt', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const added = offlineStorage.addTournamentScore('g1', 'p1', 3, 4)!;
    vi.spyOn(Date, 'now').mockReturnValue(50_000);
    offlineStorage.incrementTournamentScoreRetry(added.id);
    const [item] = offlineStorage.getTournamentSyncQueue();
    expect(item.retryCount).toBe(1);
    expect(item.lastAttempt).toBe(50_000);
  });

  it('keeps retrying past 10 attempts and stops at 60', () => {
    const added = offlineStorage.addTournamentScore('g1', 'p1', 3, 4)!;
    for (let i = 0; i < 59; i++) offlineStorage.incrementTournamentScoreRetry(added.id);
    expect(offlineStorage.getTournamentSyncQueue()).toHaveLength(1);
    offlineStorage.incrementTournamentScoreRetry(added.id);
    expect(offlineStorage.getTournamentSyncQueue()).toHaveLength(0);
  });

  it('hands back expired items once so the user can be told, and keeps the rest', () => {
    const expired = offlineStorage.addTournamentScore('g1', 'p1', 3, 4)!;
    offlineStorage.addTournamentScore('g1', 'p1', 4, 5);
    for (let i = 0; i < 60; i++) offlineStorage.incrementTournamentScoreRetry(expired.id);
    const result = offlineStorage.addTournamentResult('g1', [{
      tournament_group_id: 'g1', hole_number: 7, team_points: {}, result_label: 'Halved', updated_at: '',
    }])!;
    for (let i = 0; i < 60; i++) offlineStorage.incrementTournamentResultRetry(result.id);

    const dropped = offlineStorage.removeExpiredTournamentItems();
    expect(dropped.scores.map(item => item.holeNumber)).toEqual([3]);
    expect(dropped.results.map(item => item.payload[0].hole_number)).toEqual([7]);
    expect(offlineStorage.getTournamentSyncQueue().map(item => item.holeNumber)).toEqual([4]);

    // Already reported — not handed back again
    expect(offlineStorage.removeExpiredTournamentItems()).toEqual({ scores: [], results: [] });
  });

  it('does not silently erase expired items when a new score is queued', () => {
    const expired = offlineStorage.addTournamentScore('g1', 'p1', 3, 4)!;
    for (let i = 0; i < 60; i++) offlineStorage.incrementTournamentScoreRetry(expired.id);
    offlineStorage.addTournamentScore('g1', 'p1', 4, 5);
    expect(offlineStorage.removeExpiredTournamentItems().scores.map(item => item.holeNumber)).toEqual([3]);
  });
});
