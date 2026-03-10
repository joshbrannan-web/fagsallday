import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ScoreboardManager from '@/components/tournament-admin/ScoreboardManager';
import { toast } from 'sonner';

const TournamentAdminScoreboards: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const { scoreboards, teams, games, players, rounds, addScoreboard, updateScoreboard, deleteScoreboard, isLoading } = useTournamentDetail(tournamentId);

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tournament-admin/${tournamentId}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Scoreboards</h1>
      </div>

      <div className="max-w-lg mx-auto">
        <ScoreboardManager
          scoreboards={scoreboards}
          teams={teams}
          games={games}
          players={players}
          rounds={rounds}
          onAdd={addScoreboard}
          onUpdate={updateScoreboard}
          onDelete={deleteScoreboard}
        />
      </div>
    </div>
  );
};

export default TournamentAdminScoreboards;
