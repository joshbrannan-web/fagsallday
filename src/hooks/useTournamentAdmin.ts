import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useTournamentAdmin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isTournamentAdmin, setIsTournamentAdmin] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setIsTournamentAdmin(false);
      setRequestStatus('none');
      setIsLoading(false);
      return;
    }

    // Check if already a tournament admin
    const { data: adminData } = await supabase
      .from('tournament_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminData) {
      setIsTournamentAdmin(true);
      setRequestStatus('approved');
      setIsLoading(false);
      return;
    }

    setIsTournamentAdmin(false);

    // Check for existing request
    const { data: reqData } = await supabase
      .from('tournament_admin_requests' as any)
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    setRequestStatus((reqData as any)?.status ?? 'none');
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchStatus();
  }, [authLoading, fetchStatus]);

  const requestAccess = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from('tournament_admin_requests' as any)
      .insert({ user_id: user.id } as any);

    if (error) {
      toast.error('Failed to submit request');
      console.error(error);
      return;
    }

    setRequestStatus('pending');
    toast.success('Tournament admin request submitted!');
  }, [user]);

  return { isTournamentAdmin, requestStatus, requestAccess, isLoading: authLoading || isLoading };
};
