import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TournamentComingSoon: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background animate-fade-in">
      <Button variant="ghost" size="sm" className="absolute top-4 left-4" onClick={() => navigate('/')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <Trophy className="w-16 h-16 text-[hsl(var(--brand-gold))] mb-4" />
      <h1 className="text-2xl font-bold mb-2">Coming Soon</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Tournament play is on its way. Stay tuned for team competitions, live scoreboards, and more.
      </p>
    </div>
  );
};

export default TournamentComingSoon;
