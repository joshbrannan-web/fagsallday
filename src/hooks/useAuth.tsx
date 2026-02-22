import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          if (!localStorage.getItem('fg_session_start')) {
            localStorage.setItem('fg_session_start', String(Date.now()));
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('fg_session_start');
        }
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then((p) => {
              setProfile(p);
              if (event === 'SIGNED_IN' && p) {
                autoSyncGhin(p);
              }
            });
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Verify session is still valid server-side
        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          // Session is stale — clear everything
          setSession(null);
          setUser(null);
          setProfile(null);
          localStorage.removeItem('fg_session_start');
          setIsLoading(false);
          return;
        }
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id).then((p) => {
          setProfile(p);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

    const intervalId = setInterval(() => {
      const sessionStart = localStorage.getItem('fg_session_start');
      if (!sessionStart) return;

      const elapsed = Date.now() - Number(sessionStart);
      if (elapsed < SESSION_MAX_AGE) return;

      const cached = offlineStorage.getCachedRound();
      if (cached && cached.status === 'ACTIVE') return;

      supabase.auth.signOut();
      localStorage.removeItem('fg_session_start');
      toast.info('Session expired. Please sign in again to get the latest updates.');
    }, 60_000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
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
    // Always clear local state, even if server call fails
    setUser(null);
    setSession(null);
    setProfile(null);
    localStorage.removeItem('fg_session_start');

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out server call failed:', e);
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
