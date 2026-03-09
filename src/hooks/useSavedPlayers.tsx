import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SavedPlayer {
  id: string;
  name: string;
  handicap_index: number;
  tee: string;
  linked_user_id?: string | null;
  ghin_number?: string | null;
  ghin_last_synced?: string | null;
  created_at: string;
  updated_at: string;
}

export const useSavedPlayers = () => {
  const { user } = useAuth();
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlayers = useCallback(async () => {
    if (!user) {
      setSavedPlayers([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_saved_players_with_profiles', { p_user_id: user.id } as any);

      if (error) throw error;
      setSavedPlayers(data || []);
    } catch (error) {
      console.error('Error fetching saved players:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const addPlayer = async (name: string, handicapIndex: number, tee: string = 'White', linkedUserId?: string | null) => {
    if (!user) {
      return null;
    }

    // Check if player with same name already exists
    const existing = savedPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Update existing player instead
      await updatePlayer(existing.id, { handicap_index: handicapIndex, tee });
      return existing;
    }

    try {
      const { data, error } = await supabase
        .from('saved_players')
        .insert({
          user_id: user.id,
          name: name.trim(),
          handicap_index: handicapIndex,
          tee,
          linked_user_id: linkedUserId || null
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      // Create reciprocal link if linking to an app user
      if (linkedUserId) {
        await supabase.rpc('link_players_bidirectional', { p_linked_user_id: linkedUserId } as any);
      }
      
      // Refetch to get joined profile data (GHIN fields)
      await fetchPlayers();
      return data as SavedPlayer;
    } catch (error) {
      console.error('Error adding player:', error);
      return null;
    }
  };

  const updatePlayer = async (id: string, updates: Partial<Pick<SavedPlayer, 'name' | 'handicap_index' | 'tee' | 'linked_user_id'>>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_players')
        .update(updates as any)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSavedPlayers(prev => 
        prev.map(p => p.id === id ? { ...p, ...updates } as SavedPlayer : p)
      );
      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  };

  const deletePlayer = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_players')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSavedPlayers(prev => prev.filter(p => p.id !== id));
      toast.success('Player removed');
      return true;
    } catch (error) {
      console.error('Error deleting player:', error);
      toast.error('Failed to delete player');
      return false;
    }
  };

  return {
    savedPlayers,
    isLoading,
    addPlayer,
    updatePlayer,
    deletePlayer,
    refetch: fetchPlayers
  };
};
