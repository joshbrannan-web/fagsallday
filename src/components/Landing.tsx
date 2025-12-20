import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroIllustration from './HeroIllustration';
import { Play, History, Flag } from 'lucide-react';
import { useApp } from '../App';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound } = useApp();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-background animate-fade-in">
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-auto">
        v1.0.0 • Offline Ready
      </p>
    </div>
  );
};

export default Landing;
