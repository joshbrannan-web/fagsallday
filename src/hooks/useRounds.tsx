import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Round, Course, Player, GameSettings } from '@/types';
import { toast } from 'sonner';
import { offlineStorage } from '@/services/offlineStorage';

interface DbRound {
  id: string;
  user_id: string;
  course_data: any;
  players_data: any;
  games_data: any;
  scores: any;
  game_data: any;
  status: string;
  start_time: string;
  created_at: string;
  updated_at: string;
}

const dbRoundToRound = (dbRound: DbRound): Round => ({
  id: dbRound.id,
  course: dbRound.course_data as Course,
  players: dbRound.players_data as Player[],
  games: dbRound.games_data as GameSettings[],
  scores: dbRound.scores || {},
  gameData: dbRound.game_data || {},
  status: dbRound.status as Round['status'],
  startTime: new Date(dbRound.start_time).getTime()
});

export const useRounds = () => {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRoundIdRef = useRef<string | null>(null);

  const fetchRounds = useCallback(async () => {
    if (!user) {
      setRounds([]);
      setCurrentRound(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      const fetchedRounds = (data || []).map(dbRoundToRound);
      setRounds(fetchedRounds);

      // Preserve manually-loaded round across refetches (e.g. tab switch)
      if (loadedRoundIdRef.current) {
        const loadedRound = fetchedRounds.find(r => r.id === loadedRoundIdRef.current);
        if (loadedRound) {
          setCurrentRound(loadedRound);
        } else {
          loadedRoundIdRef.current = null;
          const activeRound = fetchedRounds.find(r => r.status === 'ACTIVE');
          setCurrentRound(activeRound || null);
        }
      } else {
        const activeRound = fetchedRounds.find(r => r.status === 'ACTIVE');
        setCurrentRound(activeRound || null);
      }
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const createRound = async (course: Course, players: Player[], games: GameSettings[], initialGameData?: Record<string, any>): Promise<Round | null> => {
    if (!user) {
      toast.error('Please sign in to start a round');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_data: course as unknown as Record<string, unknown>,
          players_data: players as unknown as Record<string, unknown>[],
          games_data: games as unknown as Record<string, unknown>[],
          scores: {},
          game_data: initialGameData || {},
          status: 'ACTIVE',
          start_time: new Date().toISOString()
        } as any)
        .select()
        .single();

      if (error) throw error;

      const newRound = dbRoundToRound(data as DbRound);
      loadedRoundIdRef.current = null;
      setCurrentRound(newRound);
      setRounds(prev => [newRound, ...prev]);
      
      // Cache for offline play
      offlineStorage.cacheRound(newRound);
      
      return newRound;
    } catch (error) {
      console.error('Error creating round:', error);
      toast.error('Failed to start round');
      return null;
    }
  };

  const updateRound = async (roundId: string, updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status' | 'course'>>) => {
    if (!user) return false;

    // 1. ALWAYS update local state immediately (optimistic update)
    setRounds(prev => prev.map(r => 
      r.id === roundId ? { ...r, ...updates } : r
    ));

    if (currentRound?.id === roundId) {
      setCurrentRound(prev => prev ? { ...prev, ...updates } : null);
    }

    // 2. Cache the updated round locally for offline access
    offlineStorage.updateCachedRound(roundId, updates);

    // 3. If online, sync to Supabase
    if (navigator.onLine) {
      try {
        const dbUpdates: any = {};
        if (updates.scores !== undefined) dbUpdates.scores = updates.scores;
        if (updates.gameData !== undefined) dbUpdates.game_data = updates.gameData;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.course !== undefined) dbUpdates.course_data = updates.course;

        const { error } = await supabase
          .from('rounds')
          .update(dbUpdates)
          .eq('id', roundId)
          .eq('user_id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error syncing to server, queuing for later:', error);
        // Queue for later sync
        if (updates.scores !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'scores', data: { scores: updates.scores } });
        }
        if (updates.gameData !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'gameData', data: { game_data: updates.gameData } });
        }
        if (updates.status !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'status', data: { status: updates.status } });
        }
        if (updates.course !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'course', data: { course_data: updates.course } });
        }
      }
    } else {
      // Offline - queue for sync when back online
      if (updates.scores !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'scores', data: { scores: updates.scores } });
      }
      if (updates.gameData !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'gameData', data: { game_data: updates.gameData } });
      }
      if (updates.status !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'status', data: { status: updates.status } });
      }
      if (updates.course !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'course', data: { course_data: updates.course } });
      }
    }

    return true; // Always return success since local update worked
  };

  const deleteRound = async (roundId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('rounds')
        .delete()
        .eq('id', roundId)
        .eq('user_id', user.id);

      if (error) throw error;

      setRounds(prev => prev.filter(r => r.id !== roundId));
      if (currentRound?.id === roundId) {
        setCurrentRound(null);
      }

      toast.success('Round deleted');
      return true;
    } catch (error) {
      console.error('Error deleting round:', error);
      toast.error('Failed to delete round');
      return false;
    }
  };

  const finishRound = async (roundId: string) => {
    const success = await updateRound(roundId, { status: 'COMPLETE' });
    if (success) {
      loadedRoundIdRef.current = null;
      setCurrentRound(null);
      // Clear offline cache when round is complete
      offlineStorage.clearCachedRound();
    }
    return success;
  };

  const loadRound = (round: Round) => {
    loadedRoundIdRef.current = round.id;
    setCurrentRound(round);
  };

  const clearLoadedRound = () => {
    loadedRoundIdRef.current = null;
    const activeRound = rounds.find(r => r.status === 'ACTIVE');
    setCurrentRound(activeRound || null);
  };

  const lockRound = async (roundId: string) => {
    return updateRound(roundId, { status: 'LOCKED' });
  };

  const unlockRound = async (roundId: string) => {
    return updateRound(roundId, { status: 'COMPLETE' });
  };

  return {
    rounds,
    currentRound,
    isLoading,
    createRound,
    updateRound,
    deleteRound,
    finishRound,
    loadRound,
    clearLoadedRound,
    lockRound,
    unlockRound,
    refetch: fetchRounds
  };
};
