import { Round } from '@/types';

const OFFLINE_ROUND_KEY = 'fg_offline_round';
const SYNC_QUEUE_KEY = 'fg_sync_queue';
const TOURNAMENT_SYNC_QUEUE_KEY = 'fg_tournament_sync_queue';
const TOURNAMENT_RESULT_QUEUE_KEY = 'fg_tournament_result_queue';

const MAX_RETRY_COUNT = 10;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TournamentSyncQueueItem {
  id: string;
  tournamentGroupId: string;
  tournamentPlayerId: string;
  holeNumber: number;
  grossScore: number;
  timestamp: number;
  retryCount?: number;
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
}

export interface SyncQueueItem {
  id: string;
  roundId: string;
  type: 'scores' | 'gameData' | 'status' | 'course' | 'games';
  data: any;
  timestamp: number;
}

/** Remove expired items (>24h or >10 retries) from a queue array */
function pruneExpired<T extends { timestamp: number; retryCount?: number }>(items: T[]): T[] {
  const now = Date.now();
  return items.filter(item => {
    if (now - item.timestamp > MAX_AGE_MS) return false;
    if ((item.retryCount ?? 0) >= MAX_RETRY_COUNT) return false;
    return true;
  });
}

export const offlineStorage = {
  // Save current round to localStorage for offline access
  cacheRound: (round: Round) => {
    try {
      localStorage.setItem(OFFLINE_ROUND_KEY, JSON.stringify(round));
    } catch (error) {
      console.error('Failed to cache round:', error);
    }
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
    } catch (error) {
      console.error('Failed to clear cached round:', error);
    }
  },

  // Add item to sync queue for later upload
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp'>) => {
    try {
      const queue = offlineStorage.getSyncQueue();
      const newItem: SyncQueueItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      queue.push(newItem);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      return newItem;
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
      return null;
    }
  },

  // Get all pending sync items
  getSyncQueue: (): SyncQueueItem[] => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
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

  // Get count of pending items
  getPendingSyncCount: (): number => {
    return offlineStorage.getSyncQueue().length;
  },

  // ── Tournament Score Sync Queue ──

  addTournamentScore: (tournamentGroupId: string, tournamentPlayerId: string, holeNumber: number, grossScore: number) => {
    try {
      const queue = offlineStorage.getTournamentSyncQueue();
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
      const queue = offlineStorage.getTournamentResultQueue();
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
};
