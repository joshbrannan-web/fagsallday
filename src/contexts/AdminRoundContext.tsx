import React, { createContext, useContext, useState, useEffect } from 'react';
import { Round, Player, Course, GameSettings } from '../types';
import { calculateRoundTotals } from '../services/gameEngine';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface AdminRoundState {
  currentRound: Round | null;
  roundTotals: { [playerId: string]: number };
  isLoading: boolean;
  error: string | null;
  // Read-only stubs - no actual updates allowed
  updateScore: (holeNumber: number, playerId: string, score: number) => void;
  updateGameData: (gameId: string, holeNumber: number, key: string, value: any) => void;
  updateGameDataBatch: (gameId: string, holeNumber: number, updates: Record<string, any>) => void;
  finishRound: () => void;
}

const AdminRoundContext = createContext<AdminRoundState | undefined>(undefined);

export const useAdminRound = () => {
  const context = useContext(AdminRoundContext);
  if (!context) throw new Error("useAdminRound must be used within AdminRoundProvider");
  return context;
};

interface AdminRoundProviderProps {
  roundId: string;
  children: React.ReactNode;
}
const reconstructRound = (data: any): Round => ({
  id: data.id,
  course: data.course_data as Course,
  players: data.players_data as Player[],
  games: data.games_data as GameSettings[],
  scores: data.scores as { [holeNumber: number]: { [playerId: string]: number | null } },
  gameData: data.game_data as { [gameId: string]: { [holeNumber: number]: any } },
  status: data.status as 'SETUP' | 'ACTIVE' | 'COMPLETE',
  startTime: new Date(data.start_time).getTime(),
});

export const AdminRoundProvider: React.FC<AdminRoundProviderProps> = ({ roundId, children }) => {
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [roundTotals, setRoundTotals] = useState<{ [playerId: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRound = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', roundId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error('Round not found');

        const round = reconstructRound(data);
        setCurrentRound(round);
        setRoundTotals(calculateRoundTotals(round));
      } catch (err: any) {
        console.error('Error fetching round:', err);
        setError(err.message || 'Failed to load round');
      } finally {
        setIsLoading(false);
      }
    };

    if (roundId) {
      fetchRound();
    }
  }, [roundId]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!roundId) return;

    const channel = supabase
      .channel(`admin-round-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rounds',
          filter: `id=eq.${roundId}`,
        },
        (payload) => {
          const round = reconstructRound(payload.new);
          setCurrentRound(round);
          setRoundTotals(calculateRoundTotals(round));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  // Read-only stubs - do nothing
  const updateScore = () => {};
  const updateGameData = () => {};
  const updateGameDataBatch = () => {};
  const finishRound = () => {};

  const value: AdminRoundState = {
    currentRound,
    roundTotals,
    isLoading,
    error,
    updateScore,
    updateGameData,
    updateGameDataBatch,
    finishRound
  };

  return (
    <AdminRoundContext.Provider value={value}>
      {children}
    </AdminRoundContext.Provider>
  );
};
