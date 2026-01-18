import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroIllustration from './HeroIllustration';
import { Play, History, Flag, User, LogOut, Loader2, Users, Shield } from 'lucide-react';
import { useApp } from '../App';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, isLoading: appLoading } = useApp();
  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const { isAdmin } = useAdminAuth();

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
      {/* User Menu - Top Right */}
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
              {currentRound && currentRound.status === 'ACTIVE' && (
                <button
                  onClick={() => navigate('/active')}
                  className="w-full bg-success text-success-foreground font-bold py-4 px-6 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg animate-pulse-subtle"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Resume Round
                </button>
              )}
              
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
