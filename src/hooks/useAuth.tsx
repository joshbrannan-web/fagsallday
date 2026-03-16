import React, { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from '@/services/offlineStorage';
import { toast } from 'sonner';

interface Profile {
  id: string;
  display_name: string | null;
  handicap_index: number;
  ghin_number: string | null;
  ghin_last_synced: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName: string, handicapIndex: number) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'handicap_index' | 'ghin_number' | 'ghin_last_synced'>>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialValidationDone = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const autoSyncGhin = async (p: Profile) => {
    if (!p.ghin_number) return;
    const SYNC_INTERVAL = 24 * 60 * 60 * 1000;
    if (p.ghin_last_synced && Date.now() - new Date(p.ghin_last_synced).getTime() < SYNC_INTERVAL) return;

    try {
      const { data, error } = await supabase.functions.invoke('sync-ghin-handicap', {
        body: { ghin_number: p.ghin_number, update_profile: true },
      });
      if (error || !data) return;
      const newIndex = data.handicap_index;
      if (newIndex != null && newIndex !== p.handicap_index) {
        setProfile(prev => prev ? { ...prev, handicap_index: newIndex, ghin_last_synced: new Date().toISOString() } : null);
        toast.success(`Handicap updated to ${newIndex}`);
      } else {
        setProfile(prev => prev ? { ...prev, ghin_last_synced: new Date().toISOString() } : null);
      }
    } catch {
      // silently ignore
    }
  };

  const clearSessionState = () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('fg_session_start');
    localStorage.removeItem('fg_last_activity');
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // CRITICAL: Skip INITIAL_SESSION events — we validate server-side below.
        // This prevents the app from rendering as "logged in" with a stale cached token.
        if (event === 'INITIAL_SESSION') {
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          const now = String(Date.now());
          if (!localStorage.getItem('fg_session_start')) {
            localStorage.setItem('fg_session_start', now);
          }
          localStorage.setItem('fg_last_activity', now);
          
          if (newSession?.user) {
            setTimeout(() => {
              fetchProfile(newSession.user.id).then((p) => {
                setProfile(p);
                if (p) autoSyncGhin(p);
              });
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          clearSessionState();
        } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          // Profile already loaded, just update session/user
          setTimeout(() => {
            fetchProfile(newSession.user.id).then(setProfile);
          }, 0);
        }
      }
    );

    // THEN validate the existing session server-side (single source of truth on first load)
    // Detect if URL contains a recovery/reset code — if so, skip stale-session cleanup
    // to let the PKCE code exchange complete naturally.
    const urlHasRecoveryCode = window.location.search.includes('code=') &&
      (window.location.hash.includes('mode=reset') || window.location.search.includes('type=recovery') || window.location.search.includes('mode=reset'));

    supabase.auth.getSession().then(async ({ data: { session: cachedSession } }) => {
      if (urlHasRecoveryCode) {
        // Recovery flow in progress — don't validate/clear cached session.
        // Let the PKCE code exchange complete; onAuthStateChange will handle it.
        setIsLoading(false);
        initialValidationDone.current = true;
        return;
      }

      if (cachedSession?.user) {
        // Verify session is still valid server-side
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          // Session is stale — clear EVERYTHING including the localStorage token
          console.warn('Stale session detected on load, clearing auth state');
          try {
            await supabase.auth.signOut();
          } catch {
            // signOut may fail if token is already invalid, that's fine
          }
          clearSessionState();
          setIsLoading(false);
          initialValidationDone.current = true;
          return;
        }
        // Session is valid — set state
        setSession(cachedSession);
        setUser(cachedSession.user);
        fetchProfile(cachedSession.user.id).then((p) => {
          setProfile(p);
          setIsLoading(false);
          initialValidationDone.current = true;
        });
      } else {
        setIsLoading(false);
        initialValidationDone.current = true;
      }
    });

    // --- Periodic session health check (every 30 minutes) ---
    const SESSION_HEALTH_INTERVAL = 30 * 60 * 1000;
    const healthCheckId = setInterval(async () => {
      // Only check if we think we're logged in and the tab is visible
      if (!document.hidden && initialValidationDone.current) {
        const currentSession = await supabase.auth.getSession();
        if (currentSession.data.session) {
          const { error } = await supabase.auth.getUser();
          if (error) {
            const cached = offlineStorage.getCachedRound();
            const hasActiveRound = cached && cached.status === 'ACTIVE';
            if (hasActiveRound) {
              toast.warning('Session expired — your scores are saved locally. Please sign in to sync.', { duration: 10000 });
            } else {
              try { await supabase.auth.signOut(); } catch {}
              clearSessionState();
              toast.info('Session expired. Please sign in again.');
            }
          }
        }
      }
    }, SESSION_HEALTH_INTERVAL);

    // --- Inactivity tracking ---
    const INACTIVITY_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours
    let lastActivityWrite = Date.now();

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastActivityWrite < 60_000) return; // throttle to 60s
      lastActivityWrite = now;
      localStorage.setItem('fg_last_activity', String(now));
    };

    window.addEventListener('pointerdown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity, true);

    // --- Session expiry checks ---
    const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

    const intervalId = setInterval(() => {
      const sessionStart = localStorage.getItem('fg_session_start');
      if (!sessionStart) return;

      const cached = offlineStorage.getCachedRound();
      const hasActiveRound = cached && cached.status === 'ACTIVE';

      // 24-hour wall-clock check
      const elapsed = Date.now() - Number(sessionStart);
      if (elapsed >= SESSION_MAX_AGE && !hasActiveRound) {
        supabase.auth.signOut();
        clearSessionState();
        toast.info('Session expired. Please sign in again to get the latest updates.');
        return;
      }

      // 4-hour inactivity check
      const lastActivity = localStorage.getItem('fg_last_activity');
      if (lastActivity) {
        const idle = Date.now() - Number(lastActivity);
        if (idle >= INACTIVITY_MAX_AGE && !hasActiveRound) {
          supabase.auth.signOut();
          clearSessionState();
          toast.info('Signed out due to inactivity.');
          return;
        }
      }
    }, 60_000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
      clearInterval(healthCheckId);
      window.removeEventListener('pointerdown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity, true);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string, handicapIndex: number) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          handicap_index: handicapIndex
        }
      }
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    const cached = offlineStorage.getCachedRound();
    const hasActiveRound = cached && cached.status === 'ACTIVE';

    // Always clear auth state
    setUser(null);
    setSession(null);
    setProfile(null);
    try { await supabase.auth.signOut(); } catch {}

    if (hasActiveRound) {
      // Preserve round data + sync queue, just clear session keys
      localStorage.removeItem('fg_current_round');
      localStorage.removeItem('fg_history');
      localStorage.removeItem('fg_saved_courses');
      localStorage.removeItem('fg_session_start');
      localStorage.removeItem('fg_last_activity');
      toast.warning('Active round preserved locally. Sign back in to sync your scores.', { duration: 8000 });
    } else {
      // Full hard reset — clear everything
      offlineStorage.clearCachedRound();
      offlineStorage.clearSyncQueue();
      offlineStorage.clearTournamentSyncQueue();
      localStorage.removeItem('fg_current_round');
      localStorage.removeItem('fg_history');
      localStorage.removeItem('fg_saved_courses');
      localStorage.removeItem('fg_session_start');
      localStorage.removeItem('fg_last_activity');
      localStorage.removeItem('fg_build_hash');

      // Unregister service worker so next load fetches fresh SW
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // Purge all cached assets
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      // Hard reload to fetch fresh assets
      window.location.reload();
    }
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'display_name' | 'handicap_index' | 'ghin_number' | 'ghin_last_synced'>>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLoading,
      signUp,
      signIn,
      signOut,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
