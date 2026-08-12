import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Round, Course, Player, GameSettings } from '@/types';
import { toast } from 'sonner';
import { offlineStorage } from '@/services/offlineStorage';
import { mergeScores, mergeGameData, countScoredHoles, fillScoreGaps, fillGameDataGaps } from '@/lib/mergeRoundData';


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

const dbRoundToRound = (dbRound: DbRound, isShared = false, ownerName?: string): Round => {
  const gd = (dbRound.game_data || {}) as any;
  const startHole = gd?._ROUND_META?.startHole;
  return {
    id: dbRound.id,
    course: dbRound.course_data as Course,
    players: dbRound.players_data as Player[],
    games: dbRound.games_data as GameSettings[],
    scores: dbRound.scores || {},
    gameData: gd,
    status: dbRound.status as Round['status'],
    startTime: new Date(dbRound.start_time).getTime(),
    startHole: typeof startHole === 'number' ? startHole : 1,
    isFavorite: (dbRound as any).is_favorite || false,
    isShared,
    ownerName,
  };
};

// Insert round participants for linked players
const insertRoundParticipants = async (roundId: string, players: Player[], ownerId: string) => {
  const participants: { round_id: string; user_id: string; player_name: string }[] = [];
  
  // Add the round owner
  participants.push({ round_id: roundId, user_id: ownerId, player_name: 'Owner' });
  
  // Add linked players (excluding the owner)
  for (const player of players) {
    if (player.linkedUserId && player.linkedUserId !== ownerId) {
      participants.push({
        round_id: roundId,
        user_id: player.linkedUserId,
        player_name: player.name,
      });
    }
  }

  if (participants.length > 0) {
    const { error } = await supabase
      .from('round_participants')
      .upsert(participants as any[], { onConflict: 'round_id,user_id' });
    
    if (error) {
      console.error('Error inserting round participants:', error);
      toast.warning('Some players may not see this round in their account. You can reshare the round link.');
    }
  }
};

/**
 * Fill an ACTIVE round's gaps from the offline cache so holes whose DB write is still
 * queued stay visible after a reload — and re-queue any cell the server is missing so it
 * actually gets persisted.
 */
const hydrateFromCache = (round: Round): Round => {
  if (round.status !== 'ACTIVE' || round.isShared) return round;
  const cached = offlineStorage.getCachedRound();
  if (!cached || cached.id !== round.id) return round;

  const serverScores = (round.scores || {}) as Record<string, Record<string, number>>;
  const cachedScores = (cached.scores || {}) as Record<string, Record<string, number>>;

  let requeued = 0;
  for (const hole of Object.keys(cachedScores)) {
    const holeNumber = Number(hole);
    if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) continue;
    for (const playerId of Object.keys(cachedScores[hole] || {})) {
      const score = cachedScores[hole][playerId];
      if (!Number.isInteger(score) || score < 1 || score > 99) continue;
      if (serverScores[hole]?.[playerId] !== undefined) continue;
      offlineStorage.addToSyncQueue({
        roundId: round.id,
        type: 'scorePatch',
        data: { holeNumber, playerId, score },
      });
      requeued += 1;
    }
  }

  if (requeued > 0) {
    console.warn(`[rounds] Re-queued ${requeued} cached score(s) missing from the server`);
  }

  return {
    ...round,
    scores: fillScoreGaps(round.scores, cached.scores),
    gameData: fillGameDataGaps(round.gameData, cached.gameData),
  };
};

export const useRounds = () => {

  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRoundIdRef = useRef<string | null>(null);
  const pendingDbUpdatesRef = useRef<Record<string, any>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRoundIdRef = useRef<string | null>(null);
  const replaceBlobsRef = useRef(false);


  // Park any un-flushed payload in the offline queue when the app is hidden or closed.
  useEffect(() => {
    const stash = () => {
      const roundId = pendingRoundIdRef.current;
      const payload = pendingDbUpdatesRef.current;
      if (!roundId || Object.keys(payload).length === 0) return;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingDbUpdatesRef.current = {};
      if (payload.scores !== undefined) offlineStorage.addToSyncQueue({ roundId, type: 'scores', data: { scores: payload.scores } });
      if (payload.game_data !== undefined) offlineStorage.addToSyncQueue({ roundId, type: 'gameData', data: { game_data: payload.game_data } });
      if (payload.games_data !== undefined) offlineStorage.addToSyncQueue({ roundId, type: 'games', data: { games_data: payload.games_data } });
    };

    const onHide = () => { if (document.visibilityState === 'hidden') stash(); };
    window.addEventListener('pagehide', stash);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', stash);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);


  const flushPendingUpdates = useCallback(async (roundId: string) => {
    if (!user) return;
    const payload = pendingDbUpdatesRef.current;
    if (Object.keys(payload).length === 0) return;

    pendingDbUpdatesRef.current = {};
    const replace = replaceBlobsRef.current;
    replaceBlobsRef.current = false;

    if (navigator.onLine) {
      try {
        // Merge against the authoritative server blob so a stale local snapshot
        // can never wipe holes recorded by another session/device.
        const writePayload: any = { ...payload };
        if (!replace && (payload.scores !== undefined || payload.game_data !== undefined)) {
          const { data: serverRow } = await supabase
            .from('rounds')
            .select('scores, game_data')
            .eq('id', roundId)
            .maybeSingle();

          if (serverRow) {
            if (payload.scores !== undefined) {
              const merged = mergeScores(serverRow.scores, payload.scores);
              if (countScoredHoles(merged) > countScoredHoles(payload.scores)) {
                console.warn('[rounds] Stale scores snapshot detected — merged with server copy instead of overwriting');
              }
              writePayload.scores = merged;
            }
            if (payload.game_data !== undefined) {
              writePayload.game_data = mergeGameData(serverRow.game_data, payload.game_data);
            }
          }
        }



        const { error } = await supabase
          .from('rounds')
          .update(writePayload)
          .eq('id', roundId)
          .eq('user_id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error syncing to server, queuing for later:', error);
        if (payload.scores !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'scores', data: { scores: payload.scores } });
        }
        if (payload.game_data !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'gameData', data: { game_data: payload.game_data } });
        }
      }
    } else {
      if (payload.scores !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'scores', data: { scores: payload.scores } });
      }
      if (payload.game_data !== undefined) {
        offlineStorage.addToSyncQueue({ roundId, type: 'gameData', data: { game_data: payload.game_data } });
      }
    }
  }, [user]);


  const fetchRounds = useCallback(async () => {
    if (!user) {
      setRounds([]);
      setCurrentRound(null);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch own rounds
      const { data: ownData, error: ownError } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (ownError) throw ownError;

      const ownRounds = (ownData || []).map(d => hydrateFromCache(dbRoundToRound(d as DbRound)));

      // Fetch shared rounds (where user is a participant but not the owner)
      const { data: participantData, error: partError } = await supabase
        .from('round_participants')
        .select('round_id, player_name')
        .eq('user_id', user.id);

      let sharedRounds: Round[] = [];
      if (!partError && participantData && participantData.length > 0) {
        const ownRoundIds = new Set(ownRounds.map(r => r.id));
        const sharedRoundIds = (participantData as any[])
          .map(p => p.round_id)
          .filter(id => !ownRoundIds.has(id));

        if (sharedRoundIds.length > 0) {
          const { data: sharedData, error: sharedError } = await supabase
            .from('rounds')
            .select('*')
            .in('id', sharedRoundIds)
            .in('status', ['ACTIVE', 'LOCKED', 'COMPLETE'])
            .order('start_time', { ascending: false });

          if (!sharedError && sharedData) {
            // Derive owner name from the round's first player (typically the round creator)
            sharedRounds = (sharedData as any[]).map(d => {
              const players = d.players_data as any[];
              const ownerName = players?.[0]?.name || 'Unknown';
              return dbRoundToRound(d as DbRound, true, ownerName);
            });
          }
        }
      }

      const allRounds = [...ownRounds, ...sharedRounds].sort((a, b) => b.startTime - a.startTime);
      setRounds(allRounds);

      // Preserve manually-loaded round across refetches
      if (loadedRoundIdRef.current) {
        const loadedRound = allRounds.find(r => r.id === loadedRoundIdRef.current);
        if (loadedRound) {
          setCurrentRound(loadedRound);
        } else {
          loadedRoundIdRef.current = null;
          const activeRound = allRounds.find(r => r.status === 'ACTIVE' && !r.isShared)
                           || allRounds.find(r => r.status === 'ACTIVE' && r.isShared);
          setCurrentRound(activeRound || null);
        }
      } else {
        const activeRound = allRounds.find(r => r.status === 'ACTIVE' && !r.isShared)
                         || allRounds.find(r => r.status === 'ACTIVE' && r.isShared);
        setCurrentRound(activeRound || null);
      }
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  // Realtime subscription for shared active rounds
  useEffect(() => {
    const sharedActiveIds = rounds
      .filter(r => r.isShared && r.status === 'ACTIVE')
      .map(r => r.id);

    if (sharedActiveIds.length === 0) return;

    const channel = supabase
      .channel('shared-active-rounds')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rounds',
          filter: `id=in.(${sharedActiveIds.join(',')})`,
        },
        (payload) => {
          const updated = payload.new as DbRound;
          
          const players = (updated.players_data as Player[]);
          const ownerName = players?.[0]?.name || 'Unknown';
          const updatedRound = dbRoundToRound(updated, true, ownerName);

          setRounds(prev => prev.map(r => r.id === updated.id ? updatedRound : r));
          if (loadedRoundIdRef.current === updated.id) {
            setCurrentRound(updatedRound);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rounds.filter(r => r.isShared && r.status === 'ACTIVE').map(r => r.id).join(',')]);

  const createRound = async (course: Course, players: Player[], games: GameSettings[], initialGameData?: Record<string, any>, startHole: number = 1): Promise<Round | null> => {
    if (!user) {
      toast.error('Please sign in to start a round');
      return null;
    }

    try {
      const mergedGameData: Record<string, any> = {
        ...(initialGameData || {}),
        _ROUND_META: {
          ...((initialGameData as any)?._ROUND_META || {}),
          startHole: startHole || 1,
        },
      };
      const { data, error } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_data: course as unknown as Record<string, unknown>,
          players_data: players as unknown as Record<string, unknown>[],
          games_data: games as unknown as Record<string, unknown>[],
          scores: {},
          game_data: mergedGameData,
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
      
      // Insert participants immediately so linked players can see the round
      await insertRoundParticipants(data.id, players, user.id);
      
      // Cache for offline play
      offlineStorage.cacheRound(newRound);
      
      return newRound;
    } catch (error) {
      console.error('Error creating round:', error);
      toast.error('Failed to start round');
      return null;
    }
  };

  const queueUpdatesForSync = (roundId: string, updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status' | 'course' | 'games'>>) => {
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
    if (updates.games !== undefined) {
      offlineStorage.addToSyncQueue({ roundId, type: 'games', data: { games_data: updates.games } });
    }
  };

  const updateRound = async (
    roundId: string,
    updates: Partial<Pick<Round, 'scores' | 'gameData' | 'status' | 'course' | 'games'>>,
    options?: { localOnly?: boolean }
  ) => {
    if (!user) return false;

    // 1. Always update local state immediately (optimistic update)
    setRounds(prev => prev.map(r =>
      r.id === roundId ? { ...r, ...updates } : r
    ));
    if (currentRound?.id === roundId) {
      setCurrentRound(prev => prev ? { ...prev, ...updates } : null);
    }

    // 2. Cache locally for offline access
    offlineStorage.updateCachedRound(roundId, updates);

    // 2b. Local-only updates (already persisted via atomic patch RPCs) stop here —
    // queueing a whole-blob write here is what lets stale snapshots clobber holes.
    if (options?.localOnly) return true;

    // 3. Determine whether this is a deferred (scores/gameData/games) or immediate (status/course) update
    const hasDeferred = updates.scores !== undefined || updates.gameData !== undefined || updates.games !== undefined;
    const hasImmediate = updates.status !== undefined || updates.course !== undefined;


    if (hasDeferred) {
      pendingRoundIdRef.current = roundId;
      // Accumulate into pending payload (last write wins per key)
      if (updates.scores !== undefined) {
        pendingDbUpdatesRef.current.scores = updates.scores;
      }
      if (updates.gameData !== undefined) {
        pendingDbUpdatesRef.current.game_data = updates.gameData;
      }
      if (updates.games !== undefined) {
        pendingDbUpdatesRef.current.games_data = updates.games;
      }

      // Reset the debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushPendingUpdates(roundId);
      }, 3000);
    }

    if (hasImmediate) {
      // Flush any pending deferred updates first so status change lands after latest scores
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      await flushPendingUpdates(roundId);

      // Now write the immediate fields
      if (navigator.onLine) {
        try {
          const dbUpdates: any = {};
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          if (updates.course !== undefined) dbUpdates.course_data = updates.course;

          const { error } = await supabase
            .from('rounds')
            .update(dbUpdates)
            .eq('id', roundId)
            .eq('user_id', user.id);

          if (error) throw error;
        } catch (error) {
          console.error('Error syncing status/course to server, queuing for later:', error);
          if (updates.status !== undefined) {
            offlineStorage.addToSyncQueue({ roundId, type: 'status', data: { status: updates.status } });
          }
          if (updates.course !== undefined) {
            offlineStorage.addToSyncQueue({ roundId, type: 'course', data: { course_data: updates.course } });
          }
        }
      } else {
        if (updates.status !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'status', data: { status: updates.status } });
        }
        if (updates.course !== undefined) {
          offlineStorage.addToSyncQueue({ roundId, type: 'course', data: { course_data: updates.course } });
        }
      }
    }

    return true;
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

      loadedRoundIdRef.current = null;
      offlineStorage.clearCachedRound();
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
    // Insert participants before finishing
    if (user) {
      const round = rounds.find(r => r.id === roundId);
      if (round) {
        await insertRoundParticipants(roundId, round.players, user.id);
      }
    }

    const success = await updateRound(roundId, { status: 'COMPLETE' });
    if (success) {
      loadedRoundIdRef.current = null;
      setCurrentRound(null);
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
    const activeRound = rounds.find(r => r.status === 'ACTIVE' && !r.isShared)
                     || rounds.find(r => r.status === 'ACTIVE' && r.isShared);
    setCurrentRound(activeRound || null);
  };

  const lockRound = async (roundId: string) => {
    // Insert participants before locking
    if (user) {
      const round = rounds.find(r => r.id === roundId);
      if (round) {
        await insertRoundParticipants(roundId, round.players, user.id);
      }
    }

    return updateRound(roundId, { status: 'LOCKED' });
  };

  const unlockRound = async (roundId: string) => {
    return updateRound(roundId, { status: 'COMPLETE' });
  };

  const toggleRoundFavorite = async (roundId: string) => {
    if (!user) return false;

    const round = rounds.find(r => r.id === roundId);
    if (!round) return false;

    const newValue = !round.isFavorite;

    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, isFavorite: newValue } : r));
    if (currentRound?.id === roundId) {
      setCurrentRound(prev => prev ? { ...prev, isFavorite: newValue } : null);
    }

    try {
      const { error } = await supabase
        .from('rounds')
        .update({ is_favorite: newValue } as any)
        .eq('id', roundId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setRounds(prev => prev.map(r => r.id === roundId ? { ...r, isFavorite: !newValue } : r));
      if (currentRound?.id === roundId) {
        setCurrentRound(prev => prev ? { ...prev, isFavorite: !newValue } : null);
      }
      toast.error('Failed to update favorite');
      return false;
    }
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
    toggleRoundFavorite,
    refetch: fetchRounds
  };
};
