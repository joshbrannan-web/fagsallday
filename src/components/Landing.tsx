import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroIllustration from './HeroIllustration';
import { Play, History, Flag, User, LogOut, Loader2, Users, Shield, Edit2, HelpCircle, Eye } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import OnboardingOverlay from './OnboardingOverlay';
import GhinPrompt from './GhinPrompt';
import WhatsNewDialog from './WhatsNewDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, clearLoadedRound, isLoading: appLoading, roundHistory, loadPastRound } = useApp();
  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const { isAdmin } = useAdminAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Clear any manually-loaded past round when returning to home
  React.useEffect(() => {
    clearLoadedRound();
  }, []);

  // Post-signup claim flow: auto-link invited players
  useEffect(() => {
    if (!user) return;
    const roundId = localStorage.getItem('fg_invite_round_id');
    const playerName = localStorage.getItem('fg_invite_player_name');
    if (!roundId || !playerName) return;

    // Clear immediately to prevent re-runs
    localStorage.removeItem('fg_invite_round_id');
    localStorage.removeItem('fg_invite_player_name');

    const claimInvite = async () => {
      try {
        // Find unclaimed pending link
        const { data: pending, error: fetchErr } = await supabase
          .from('pending_round_links' as any)
          .select('id, owner_user_id')
          .eq('round_id', roundId)
          .eq('player_name', decodeURIComponent(playerName))
          .is('claimed_by', null)
          .limit(1)
          .single();

        if (fetchErr || !pending) return;

        // Claim it
        await supabase
          .from('pending_round_links' as any)
          .update({ claimed_by: user.id })
          .eq('id', (pending as any).id);

        // Auto-link with round owner
        const ownerUserId = (pending as any).owner_user_id;
        if (ownerUserId && ownerUserId !== user.id) {
          await supabase.rpc('link_players_bidirectional', { p_linked_user_id: ownerUserId });
        }

        // Insert as round participant
        await supabase.from('round_participants').insert({
          round_id: roundId,
          user_id: user.id,
          player_name: decodeURIComponent(playerName),
        });

        toast.success('You\'ve been linked to the round!');
        navigate('/scorecard');
      } catch (err) {
        console.error('Failed to claim invite:', err);
      }
    };

    claimInvite();
  }, [user]);

  const isLoading = appLoading || authLoading;

  const handleSignOut = async () => {
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-background animate-fade-in">
      {/* Onboarding Overlay */}
      {user && <OnboardingOverlay forceOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />}
      {user && <WhatsNewDialog />}
      {user && <GhinPrompt />}
      <div className="absolute top-4 right-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{profile?.display_name || 'Profile'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile?.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  Handicap: {profile?.handicap_index ?? 'Not set'}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/players')}>
                <Users className="w-4 h-4 mr-2" />
                My Players
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowOnboarding(true)}>
                <HelpCircle className="w-4 h-4 mr-2" />
                How It Works
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/auth')}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            Sign In
          </Button>
        )}
      </div>

      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flag className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-brand-dark">
          F&Gs
          <span className="block text-primary">All Day</span>
        </h1>
        <p className="text-muted-foreground mb-8">
          Track scores, bets, and payouts automatically.
        </p>

        {/* Hero Illustration */}
        <div className="mb-10 relative">
          <HeroIllustration className="w-full max-w-[320px] mx-auto h-auto drop-shadow-sm" />
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {user ? (
            <>
              {currentRound && currentRound.status === 'ACTIVE' && !currentRound.isShared && (
                <button
                  onClick={() => navigate('/active')}
                  className="w-full bg-success text-success-foreground font-bold py-4 px-6 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg animate-pulse-subtle"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Resume Round
                </button>
              )}

              {(() => {
                const sharedActiveRound = roundHistory.find(r => r.isShared && r.status === 'ACTIVE');
                if (!sharedActiveRound) return null;
                return (
                  <button
                    onClick={() => {
                      loadPastRound(sharedActiveRound);
                      navigate('/scorecard');
                    }}
                    className="w-full bg-accent text-accent-foreground font-bold py-4 px-6 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg border-2 border-primary/20"
                  >
                    <Eye className="w-5 h-5" />
                    View Active Round
                  </button>
                );
              })()}
              
              <button
                onClick={() => navigate('/setup')}
                className="w-full bg-primary text-primary-foreground font-bold py-4 px-6 rounded-xl shadow-golf active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg"
              >
                <Play className="w-5 h-5 fill-current" />
                Start New Round
              </button>

              <button
                onClick={() => navigate('/history')}
                className="w-full bg-card text-primary border-2 border-primary/20 font-bold py-3 px-6 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
              >
                <History className="w-5 h-5" />
                View Past Rounds
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-primary text-primary-foreground font-bold py-4 px-6 rounded-xl shadow-golf active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg"
              >
                <User className="w-5 h-5" />
                Sign In to Start
              </button>

              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="w-full bg-card text-primary border-2 border-primary/20 font-bold py-3 px-6 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-auto">
        v1.0.0 • {user ? 'Synced' : 'Offline Ready'}
      </p>
    </div>
  );
};

export default Landing;
