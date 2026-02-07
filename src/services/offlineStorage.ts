import { Round } from '@/types';

const OFFLINE_ROUND_KEY = 'fg_offline_round';
const SYNC_QUEUE_KEY = 'fg_sync_queue';

export interface SyncQueueItem {
  id: string;
  roundId: string;
  type: 'scores' | 'gameData' | 'status' | 'course';
  data: any;
  timestamp: number;
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
  updateCachedRound: (roundId: string, updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status'>>) => {
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
  }
};
