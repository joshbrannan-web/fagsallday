import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { Trophy, ArrowLeft, Plus, ClipboardList, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const TournamentAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin, navigate]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
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
        <h1 className="text-xl font-bold flex-1">Tournament Admin</h1>
      </div>

      <div className="max-w-4xl mx-auto grid gap-4 md:grid-cols-2">
        {/* Registrations */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Registrations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              Collect signups for upcoming events with shareable links and Google Sheet sync.
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate('/tournament-admin/registrations')}
            >
              <ListChecks className="w-4 h-4" />
              View Registrations
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => navigate('/tournament-admin/registrations?new=1')}
            >
              <Plus className="w-4 h-4" />
              Create New Registration
            </Button>
          </CardContent>
        </Card>

        {/* Tournaments */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--brand-gold))]/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
              </div>
              <CardTitle>Tournaments</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              Run live tournaments with groups, pairings, scoreboards, and scoring.
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate('/tournament-admin/tournaments')}
            >
              <ListChecks className="w-4 h-4" />
              View Tournaments
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => navigate('/tournament-admin/create')}
            >
              <Plus className="w-4 h-4" />
              Create New Tournament
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentAdmin;
