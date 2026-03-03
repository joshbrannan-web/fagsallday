import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentEntry } from '@/hooks/useTournamentEntry';
import TournamentJoinCard from '@/components/tournament/TournamentJoinCard';
import TournamentMyTournaments from '@/components/tournament/TournamentMyTournaments';

const Tournament: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const entry = useTournamentEntry();

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
      <div className="px-4 pb-8 space-y-8">
        <TournamentJoinCard
          onLookup={entry.lookupTournament}
          lookupResult={entry.lookupResult}
          lookupError={entry.lookupError}
          isLookingUp={entry.isLookingUp}
          creatorName={entry.creatorName}
          onClear={entry.clearLookup}
        />
        <TournamentMyTournaments tournaments={entry.myTournaments} />
      </div>
    </div>
  );
};

export default Tournament;
