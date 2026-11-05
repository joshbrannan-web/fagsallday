import { Round } from '@/types';

const OFFLINE_ROUND_KEY = 'fg_offline_round';
const OFFLINE_ROUND_META_KEY = 'fg_offline_round_meta';

export interface OfflineRoundMeta {
  roundId: string;
  /** When this device last wrote the cache */
  cachedAt: number;
  /** Server `updated_at` this cache was based on, when known */
  serverUpdatedAt: string | null;
}

const SYNC_QUEUE_KEY = 'fg_sync_queue';
const TOURNAMENT_SYNC_QUEUE_KEY = 'fg_tournament_sync_queue';
const TOURNAMENT_RESULT_QUEUE_KEY = 'fg_tournament_result_queue';

// Tournament queues only. With the backoff below (30s, 1m, 2m, 4m, then 5m between
// attempts) 60 attempts span roughly 4 hours 45 minutes of failed sends — about a full round.
const MAX_RETRY_COUNT = 60;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_AGE_MS_ROUND = 7 * 24 * 60 * 60 * 1000; // 7 days (round scores kept longer)

export interface TournamentSyncQueueItem {
  id: string;
  tournamentGroupId: string;
  tournamentPlayerId: string;
  holeNumber: number;
  grossScore: number;
  timestamp: number;
  retryCount?: number;
  lastAttempt?: number;
}

export interface TournamentResultQueueItem {
  id: string;
  tournamentGroupId: string;
  payload: {
    tournament_group_id: string;
    hole_number: number;
    team_points: Record<string, number>;
    player_points?: Record<string, number>;
    points_value?: number;
    result_label: string;
    updated_at: string;
  }[];
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
}

export interface SyncQueueItem {
  id: string;
  roundId: string;
  type: 'scorePatch' | 'scores' | 'gameData' | 'status' | 'course' | 'games';
  data: any;
  timestamp: number;
  retryCount?: number;
  lastAttempt?: number;
}

/**
 * Whether a tournament queue item has waited long enough to be retried. The wait doubles
 * with each failure (30s, 1m, 2m, 4m, capped at 5m) and is counted from the last attempt,
 * so a run of quick failures can't burn through the attempt limit in a few minutes.
 */
export function isTournamentRetryDue(
  item: { timestamp: number; retryCount?: number; lastAttempt?: number },
  now: number = Date.now(),
): boolean {
  const backoffMs = Math.min(30000 * Math.pow(2, item.retryCount ?? 0), 300000);
  return now - (item.lastAttempt ?? item.timestamp) >= backoffMs;
}

/**
 * Split queued tournament scores into those whose hole an official has since corrected
 * (must never be sent: the correction wins) and those that are safe to send.
 */
export function splitByAdminOverride<T extends { tournamentGroupId: string; tournamentPlayerId: string; holeNumber: number }>(
  items: T[],
  overrides: { tournament_group_id: string; tournament_player_id: string; hole_number: number }[],
): { corrected: T[]; toSend: T[] } {
  const overridden = new Set(overrides.map(o => `${o.tournament_group_id}_${o.tournament_player_id}_${o.hole_number}`));
  const corrected: T[] = [];
  const toSend: T[] = [];
  for (const item of items) {
    (overridden.has(`${item.tournamentGroupId}_${item.tournamentPlayerId}_${item.holeNumber}`) ? corrected : toSend).push(item);
  }
  return { corrected, toSend };
}

/** Remove expired items (>24h or >= MAX_RETRY_COUNT retries) from a queue array */
function pruneExpired<T extends { timestamp: number; retryCount?: number }>(items: T[]): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (now - item.timestamp > MAX_AGE_MS) return false;
    if ((item.retryCount ?? 0) >= MAX_RETRY_COUNT) return false;
    return true;
  });
}

export const offlineStorage = {
  // Save current round to localStorage for offline access.
  // `serverUpdatedAt` (ISO string) records which server revision this cache was based on.
  cacheRound: (round: Round, serverUpdatedAt?: string | null) => {
    try {
      localStorage.setItem(OFFLINE_ROUND_KEY, JSON.stringify(round));
      const prev = offlineStorage.getCacheMeta();
      const meta: OfflineRoundMeta = {
        roundId: round.id,
        cachedAt: Date.now(),
        serverUpdatedAt:
          serverUpdatedAt ?? (prev && prev.roundId === round.id ? prev.serverUpdatedAt : null),
      };
      localStorage.setItem(OFFLINE_ROUND_META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.error('Failed to cache round:', error);
    }
  },

  getCacheMeta: (): OfflineRoundMeta | null => {
    try {
      const raw = localStorage.getItem(OFFLINE_ROUND_META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /** Record the server revision the current cache is known to be in sync with. */
  setCacheBaseline: (roundId: string, serverUpdatedAt: string | null) => {
    try {
      const prev = offlineStorage.getCacheMeta();
      if (!prev || prev.roundId !== roundId) return;
      localStorage.setItem(
        OFFLINE_ROUND_META_KEY,
        JSON.stringify({ ...prev, serverUpdatedAt, cachedAt: Date.now() })
      );
    } catch {
      /* non-critical */
    }
  },

  /**
   * True when the server row has been modified after this device last wrote its cache
   * (i.e. someone else — or this user on another device — changed the round since).
   */
  isCacheStale: (roundId: string, serverUpdatedAt?: string | null): boolean => {
    if (!serverUpdatedAt) return false;
    const meta = offlineStorage.getCacheMeta();
    if (!meta || meta.roundId !== roundId) return true;
    const serverMs = new Date(serverUpdatedAt).getTime();
    if (!Number.isFinite(serverMs)) return false;
    // Small grace window: our own write lands on the server moments after we cache it.
    return serverMs > meta.cachedAt + 1000;
  },

  // Get cached round
  getCachedRound: (): Round | null => {
    try {
      const cached = localStorage.getItem(OFFLINE_ROUND_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached round:', error);
      return null;
    }
  },

  // Update cached round locally
  updateCachedRound: (roundId: string, updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status' | 'games'>>) => {
    try {
      const cached = offlineStorage.getCachedRound();
      if (cached && cached.id === roundId) {
        const updated = { ...cached, ...updates };
        localStorage.setItem(OFFLINE_ROUND_KEY, JSON.stringify(updated));
        return updated;
      }
      return null;
    } catch (error) {
      console.error('Failed to update cached round:', error);
      return null;
    }
  },

  // Clear cached round
  clearCachedRound: () => {
    try {
      localStorage.removeItem(OFFLINE_ROUND_KEY);
      localStorage.removeItem(OFFLINE_ROUND_META_KEY);
    } catch (error) {
      console.error('Failed to clear cached round:', error);
    }
  },

  /** Drop every queued write belonging to a round (used when the round no longer exists). */
  removeSyncQueueForRound: (roundId: string) => {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      const items: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
      const filtered = items.filter(item => item.roundId !== roundId);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to clear sync queue for round:', error);
    }
  },

  /** Queued (not yet persisted) items for a round. */
  getSyncQueueForRound: (roundId: string): SyncQueueItem[] =>
    offlineStorage.getSyncQueue().filter(item => item.roundId === roundId),


  // Add item to sync queue for later upload
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp'>) => {
    try {
      const queue = offlineStorage.getSyncQueue();
      const dedupedQueue = item.type === 'scorePatch'
        ? queue.filter(existing => !(
            existing.type === 'scorePatch' &&
            existing.roundId === item.roundId &&
            existing.data?.holeNumber === item.data?.holeNumber &&
            existing.data?.playerId === item.data?.playerId
          ))
        : queue;
      const newItem: SyncQueueItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      dedupedQueue.push(newItem);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(dedupedQueue));
      return newItem;
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
      return null;
    }
  },

  // Get all pending sync items (drops only genuinely stale items, never by retry count)
  getSyncQueue: (): SyncQueueItem[] => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      const items: SyncQueueItem[] = queue ? JSON.parse(queue) : [];
      const now = Date.now();
      return items.filter(item => now - item.timestamp <= MAX_AGE_MS_ROUND);
    } catch (error) {
      console.error('Failed to get sync queue:', error);
      return [];
    }
  },

  // Clear entire sync queue after successful sync
  clearSyncQueue: () => {
    try {
      localStorage.removeItem(SYNC_QUEUE_KEY);
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
    }
  },

  // Remove specific items from queue
  removeFromSyncQueue: (ids: string[]) => {
    try {
      const queue = offlineStorage.getSyncQueue();
      const filtered = queue.filter(item => !ids.includes(item.id));
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove from sync queue:', error);
    }
  },

  // Record a failed attempt (network-level) so the drain can back off
  incrementSyncRetry: (id: string) => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      const items: SyncQueueItem[] = queue ? JSON.parse(queue) : [];
      const item = items.find(i => i.id === id);
      if (item) {
        item.retryCount = (item.retryCount ?? 0) + 1;
        item.lastAttempt = Date.now();
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Failed to increment sync retry count:', error);
    }
  },


  // Get count of pending items
  getPendingSyncCount: (): number => {
    return offlineStorage.getSyncQueue().length;
  },

  // ── Tournament Score Sync Queue ──

  addTournamentScore: (tournamentGroupId: string, tournamentPlayerId: string, holeNumber: number, grossScore: number) => {
    try {
      // Read unfiltered so expired items stay until the drain loop reports them to the user
      const raw = localStorage.getItem(TOURNAMENT_SYNC_QUEUE_KEY);
      const queue: TournamentSyncQueueItem[] = raw ? JSON.parse(raw) : [];
      // Deduplicate: replace existing entry for same group+player+hole
      const filtered = queue.filter(
        item => !(item.tournamentGroupId === tournamentGroupId && item.tournamentPlayerId === tournamentPlayerId && item.holeNumber === holeNumber)
      );
      const newItem: TournamentSyncQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tournamentGroupId,
        tournamentPlayerId,
        holeNumber,
        grossScore,
        timestamp: Date.now(),
        retryCount: 0,
      };
      filtered.push(newItem);
      localStorage.setItem(TOURNAMENT_SYNC_QUEUE_KEY, JSON.stringify(filtered));
      return newItem;
    } catch (error) {
      console.error('Failed to add tournament score to sync queue:', error);
      return null;
    }
  },

  getTournamentSyncQueue: (): TournamentSyncQueueItem[] => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_SYNC_QUEUE_KEY);
      const items: TournamentSyncQueueItem[] = queue ? JSON.parse(queue) : [];
      return pruneExpired(items);
    } catch (error) {
      console.error('Failed to get tournament sync queue:', error);
      return [];
    }
  },

  removeTournamentSyncItems: (ids: string[]) => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_SYNC_QUEUE_KEY);
      const items: TournamentSyncQueueItem[] = queue ? JSON.parse(queue) : [];
      const filtered = items.filter(item => !ids.includes(item.id));
      localStorage.setItem(TOURNAMENT_SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove from tournament sync queue:', error);
    }
  },

  incrementTournamentScoreRetry: (id: string) => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_SYNC_QUEUE_KEY);
      const items: TournamentSyncQueueItem[] = queue ? JSON.parse(queue) : [];
      const item = items.find(i => i.id === id);
      if (item) {
        item.retryCount = (item.retryCount ?? 0) + 1;
        item.lastAttempt = Date.now();
        localStorage.setItem(TOURNAMENT_SYNC_QUEUE_KEY, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Failed to increment retry count:', error);
    }
  },

  clearTournamentSyncQueue: () => {
    try {
      localStorage.removeItem(TOURNAMENT_SYNC_QUEUE_KEY);
    } catch (error) {
      console.error('Failed to clear tournament sync queue:', error);
    }
  },

  getPendingTournamentSyncCount: (): number => {
    return offlineStorage.getTournamentSyncQueue().length;
  },

  // ── Tournament Result Sync Queue ──

  addTournamentResult: (tournamentGroupId: string, payload: TournamentResultQueueItem['payload']) => {
    try {
      // Read unfiltered so expired items stay until the drain loop reports them to the user
      const raw = localStorage.getItem(TOURNAMENT_RESULT_QUEUE_KEY);
      const queue: TournamentResultQueueItem[] = raw ? JSON.parse(raw) : [];
      // Deduplicate by group ID — replace existing entry
      const filtered = queue.filter(item => item.tournamentGroupId !== tournamentGroupId);
      const newItem: TournamentResultQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tournamentGroupId,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
      };
      filtered.push(newItem);
      localStorage.setItem(TOURNAMENT_RESULT_QUEUE_KEY, JSON.stringify(filtered));
      return newItem;
    } catch (error) {
      console.error('Failed to add tournament result to sync queue:', error);
      return null;
    }
  },

  getTournamentResultQueue: (): TournamentResultQueueItem[] => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_RESULT_QUEUE_KEY);
      const items: TournamentResultQueueItem[] = queue ? JSON.parse(queue) : [];
      return pruneExpired(items);
    } catch (error) {
      console.error('Failed to get tournament result queue:', error);
      return [];
    }
  },

  removeTournamentResultItems: (ids: string[]) => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_RESULT_QUEUE_KEY);
      const items: TournamentResultQueueItem[] = queue ? JSON.parse(queue) : [];
      const filtered = items.filter(item => !ids.includes(item.id));
      localStorage.setItem(TOURNAMENT_RESULT_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove from tournament result queue:', error);
    }
  },

  incrementTournamentResultRetry: (id: string) => {
    try {
      const queue = localStorage.getItem(TOURNAMENT_RESULT_QUEUE_KEY);
      const items: TournamentResultQueueItem[] = queue ? JSON.parse(queue) : [];
      const item = items.find(i => i.id === id);
      if (item) {
        item.retryCount += 1;
        item.lastAttempt = Date.now();
        localStorage.setItem(TOURNAMENT_RESULT_QUEUE_KEY, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Failed to increment result retry count:', error);
    }
  },

  clearTournamentResultQueue: () => {
    try {
      localStorage.removeItem(TOURNAMENT_RESULT_QUEUE_KEY);
    } catch (error) {
      console.error('Failed to clear tournament result queue:', error);
    }
  },

  getPendingTournamentResultCount: (): number => {
    return offlineStorage.getTournamentResultQueue().length;
  },

  /** Whether a tournament queue item is still waiting to be sent. */
  isTournamentItemQueued: (queue: 'scores' | 'results', id: string): boolean => {
    try {
      const raw = localStorage.getItem(queue === 'scores' ? TOURNAMENT_SYNC_QUEUE_KEY : TOURNAMENT_RESULT_QUEUE_KEY);
      const items: { id: string }[] = raw ? JSON.parse(raw) : [];
      return items.some(item => item.id === id);
    } catch {
      return false;
    }
  },

  /**
   * Drop every queued tournament score and result for one tournament group (one group's
   * round). Only call after that round was submitted and every score confirmed written.
   */
  removeTournamentItemsForGroup: (tournamentGroupId: string) => {
    for (const key of [TOURNAMENT_SYNC_QUEUE_KEY, TOURNAMENT_RESULT_QUEUE_KEY]) {
      try {
        const raw = localStorage.getItem(key);
        const items: { tournamentGroupId: string }[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem(key, JSON.stringify(items.filter(item => item.tournamentGroupId !== tournamentGroupId)));
      } catch (error) {
        console.error('Failed to clear tournament queue for group:', error);
      }
    }
  },

  /**
   * Permanently remove tournament queue items that have run out of attempts or time,
   * and return them so the caller can tell the user.
   */
  removeExpiredTournamentItems: (): { scores: TournamentSyncQueueItem[]; results: TournamentResultQueueItem[] } => {
    const takeExpired = <T extends { id: string; timestamp: number; retryCount?: number }>(key: string): T[] => {
      try {
        const raw = localStorage.getItem(key);
        const items: T[] = raw ? JSON.parse(raw) : [];
        const kept = pruneExpired(items);
        if (kept.length === items.length) return [];
        const keptIds = new Set(kept.map(item => item.id));
        localStorage.setItem(key, JSON.stringify(kept));
        return items.filter(item => !keptIds.has(item.id));
      } catch (error) {
        console.error('Failed to remove expired tournament queue items:', error);
        return [];
      }
    };
    return {
      scores: takeExpired<TournamentSyncQueueItem>(TOURNAMENT_SYNC_QUEUE_KEY),
      results: takeExpired<TournamentResultQueueItem>(TOURNAMENT_RESULT_QUEUE_KEY),
    };
  },
};
