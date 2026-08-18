import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';
import { fetchTestGroupSummaries, type TestGroupSummary } from '@/services/testRounds';
import { fetchRoundMatches, type RoundMatch } from '@/services/roundLevelScoring';
import { toast } from 'sonner';

const TournamentAdminTestConsole: React.FC = () => {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();

  const [groups, setGroups] = useState<TestGroupSummary[]>([]);
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  const [round, setRound] = useState<any>(null);
  const [thru, setThru] = useState<Record<string, number>>({});
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  const load = useCallback(async () => {
    if (!roundId) return;
    setIsLoading(true);
    const [g, m, rRes] = await Promise.all([
      fetchTestGroupSummaries(roundId),
      fetchRoundMatches(roundId, { isTest: true }),
      supabase.from('tournament_rounds').select('*').eq('id', roundId).maybeSingle(),
    ]);
    setGroups(g);
    setMatches(m);
    setRound(rRes.data);

    if (rRes.data) {
      const { data: tp } = await supabase
        .from('tournament_players')
        .select('id, display_name')
        .eq('tournament_id', rRes.data.tournament_id);
      const names: Record<string, string> = {};
      (tp || []).forEach(p => { names[p.id] = p.display_name; });
      setPlayerNames(names);
    }

    if (g.length > 0) {
      const { data: scores } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_group_id, hole_number, gross_score')
        .in('tournament_group_id', g.map(x => x.id));
      const counts: Record<string, number> = {};
      g.forEach(x => {
        const holes = new Set(
          (scores || [])
            .filter(s => s.tournament_group_id === x.id && s.gross_score !== null)
            .map(s => s.hole_number),
        );
        counts[x.id] = holes.size;
      });
      setThru(counts);
    }
    setIsLoading(false);
  }, [roundId]);

  useEffect(() => { load(); }, [load]);

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const roundLabel = round?.name || `Round ${round?.round_number ?? ''}`;

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/tournament-admin/${tournamentId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
              Test Console
            </h1>
            <p className="text-xs text-muted-foreground">{roundLabel}</p>
          </div>
        </div>

        {roundId && (
          <TestRoundBanner
            tournamentRoundId={roundId}
            tournamentId={tournamentId}
            hideConsoleLink
            resetRedirect={`/tournament-admin/${tournamentId}`}
          />
        )}

        {groups.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No test is running for this round. Start one from the round's Test Start action.
              </p>
              <Button variant="outline" onClick={() => navigate(`/tournament-admin/${tournamentId}`)}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <Card key={g.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold flex items-center gap-2">
                      Group {g.group_number}
                      <Badge variant="outline" className="text-xs">Thru {thru[g.id] ?? 0}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {g.players.map(p => p.display_name).join(' • ') || 'No players'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${roundId}/group/${g.id}?test=1`)}
                  >
                    <ClipboardList className="w-3.5 h-3.5 mr-1" /> Enter scores
                  </Button>
                </CardContent>
              </Card>
            ))}

            {matches.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Test matches ({matches.length})
                  </p>
                  {matches.map(m => (
                    <p key={m.id} className="text-sm text-muted-foreground">
                      M{m.matchNumber}: {m.sideA.map(id => playerNames[id] || 'Player').join(' & ')} vs{' '}
                      {m.sideB.map(id => playerNames[id] || 'Player').join(' & ')}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentAdminTestConsole;
