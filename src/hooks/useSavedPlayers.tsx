import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SavedPlayer {
  id: string;
  name: string;
  handicap_index: number;
  tee: string;
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
        .from('saved_players')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

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

  const addPlayer = async (name: string, handicapIndex: number, tee: string = 'White') => {
    if (!user) {
      toast.error('Please sign in to save players');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('saved_players')
        .insert({
          user_id: user.id,
          name: name.trim(),
          handicap_index: handicapIndex,
          tee
        })
        .select()
        .single();

      if (error) throw error;
      
      setSavedPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`${name} saved to your players`);
      return data;
    } catch (error) {
      console.error('Error adding player:', error);
      toast.error('Failed to save player');
      return null;
    }
  };

  const updatePlayer = async (id: string, updates: Partial<Pick<SavedPlayer, 'name' | 'handicap_index' | 'tee'>>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_players')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSavedPlayers(prev => 
        prev.map(p => p.id === id ? { ...p, ...updates } : p)
      );
      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      toast.error('Failed to update player');
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
