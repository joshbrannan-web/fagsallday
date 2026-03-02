import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useTournamentAdmin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isTournamentAdmin, setIsTournamentAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsTournamentAdmin(false);
      setIsLoading(false);
      return;
    }
    const check = async () => {
      const { data } = await supabase
        .from('tournament_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsTournamentAdmin(!!data);
      setIsLoading(false);
    };
    if (!authLoading) check();
  }, [user, authLoading]);

  return { isTournamentAdmin, isLoading: authLoading || isLoading };
};
