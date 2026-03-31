import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournaments } from '@/hooks/useTournaments';
import { Trophy, ArrowLeft, Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import TournamentCard from '@/components/tournament-admin/TournamentCard';
import { toast } from 'sonner';

const TournamentAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const { tournaments, isLoading: tournamentsLoading } = useTournaments();

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin, navigate]);

  if (adminLoading || tournamentsLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isTournamentAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 pb-24 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Tournament Admin</h1>
      </div>

      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
          <Trophy className="w-16 h-16 text-[hsl(var(--brand-gold))]" />
          <h2 className="text-lg font-bold">No tournaments yet</h2>
          <p className="text-muted-foreground text-sm">Create your first tournament to get started</p>
          <Button onClick={() => navigate('/tournament-admin/create')}>
            Create Tournament
          </Button>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {tournaments.map(t => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}

      <Button
        size="icon"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg"
        onClick={() => navigate('/tournament-admin/create')}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default TournamentAdmin;
