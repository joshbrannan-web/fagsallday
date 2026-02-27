import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from '@/services/offlineStorage';
import { toast } from 'sonner';

declare const __APP_BUILD_HASH__: string;

const BUILD_HASH_KEY = 'fg_build_hash';

export function useVersionCheck() {
  useEffect(() => {
    const storedHash = localStorage.getItem(BUILD_HASH_KEY);

    // First visit — just store the hash
    if (!storedHash) {
      localStorage.setItem(BUILD_HASH_KEY, __APP_BUILD_HASH__);
      return;
    }

    // Same version — nothing to do
    if (storedHash === __APP_BUILD_HASH__) return;

    // New version detected — always update hash first
    localStorage.setItem(BUILD_HASH_KEY, __APP_BUILD_HASH__);

    // Protect active rounds
    const cached = offlineStorage.getCachedRound();
    if (cached && cached.status === 'ACTIVE') return;

    // Sign out and clear local state
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('fg_current_round');
      localStorage.removeItem('fg_history');
      localStorage.removeItem('fg_saved_courses');
      localStorage.removeItem('fg_session_start');
      localStorage.removeItem('fg_last_activity');
      offlineStorage.clearCachedRound();
      offlineStorage.clearSyncQueue();
      toast.info('App updated — please sign in again');
    });
  }, []);
}
