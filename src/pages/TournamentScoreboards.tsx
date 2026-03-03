import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentScoreboards } from '@/hooks/useTournamentScoreboards';
import TournamentScoreboardTabs from '@/components/tournament/TournamentScoreboardTabs';

const TournamentScoreboards: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [tournamentId, setTournamentId] = useState<string | undefined>();

  useEffect(() => {
    if (!joinCode) return;
    supabase
      .from('tournaments')
      .select('*')
      .ilike('join_code', joinCode.toUpperCase())
      .single()
      .then(({ data }) => {
        if (data) {
          setTournament(data);
          setTournamentId(data.id);
        }
      });
  }, [joinCode]);

  const { scoreboards, teams, isLoading, isLive } = useTournamentScoreboards(tournamentId);

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tournament')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="px-4 pb-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-[hsl(var(--brand-gold))]" />
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            {isLive && (
              <Badge className="bg-success text-success-foreground gap-1">
                <span className="w-2 h-2 rounded-full bg-success-foreground animate-pulse-subtle" />
                Live
              </Badge>
            )}
          </div>
          {(tournament.start_date || tournament.end_date) && (
            <p className="text-sm text-muted-foreground">
              {tournament.start_date && new Date(tournament.start_date).toLocaleDateString()}
              {tournament.end_date && ` — ${new Date(tournament.end_date).toLocaleDateString()}`}
            </p>
          )}
          {teams.length > 0 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              {teams.map((t: any, i: number) => (
                <React.Fragment key={t.id}>
                  {i > 0 && <span className="text-muted-foreground">vs</span>}
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Scoreboards */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <TournamentScoreboardTabs scoreboards={scoreboards} />
        )}
      </div>
    </div>
  );
};

export default TournamentScoreboards;
