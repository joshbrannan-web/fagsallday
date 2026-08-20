import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';
import TestScorecardSection, { type TestScorecardResult } from '@/components/tournament-admin/TestScorecardSection';
import { fetchTestGroupSummaries, recalcTestRoundResults, type TestGroupSummary } from '@/services/testRounds';
import { fetchRoundMatches, isRoundLevelGameType, type RoundMatch } from '@/services/roundLevelScoring';
import { scoresNeeded } from '@/services/tournamentEngine';
import { toast } from 'sonner';

const TournamentAdminTestScorecard: React.FC = () => {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [round, setRound] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [groups, setGroups] = useState<TestGroupSummary[]>([]);
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  const [teams, setTeams] = useState<Record<string, { name: string; color: string }>>({});
  const [players, setPlayers] = useState<Record<string, { name: string; teamId: string | null }>>({});
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [results, setResults] = useState<(TestScorecardResult & { tournament_group_id: string | null; tournament_match_id: string | null })[]>([]);

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  const load = useCallback(async () => {
    if (!roundId) return;
    setIsLoading(true);

    const [g, m, roundRes, gameRes] = await Promise.all([
      fetchTestGroupSummaries(roundId),
      fetchRoundMatches(roundId, { isTest: true }),
      supabase.from('tournament_rounds').select('*').eq('id', roundId).maybeSingle(),
      supabase.from('tournament_games').select('*').eq('tournament_round_id', roundId).maybeSingle(),
    ]);
    setGroups(g);
    setMatches(m);
    setRound(roundRes.data);
    setGame(gameRes.data);

    if (roundRes.data) {
      const [teamRes, playerRes] = await Promise.all([
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', roundRes.data.tournament_id),
        supabase.from('tournament_players').select('id, display_name, team_id').eq('tournament_id', roundRes.data.tournament_id),
      ]);
      const tm: Record<string, { name: string; color: string }> = {};
      (teamRes.data || []).forEach(t => { tm[t.id] = { name: t.name, color: t.color }; });
      setTeams(tm);
      const pm: Record<string, { name: string; teamId: string | null }> = {};
      (playerRes.data || []).forEach(p => { pm[p.id] = { name: p.display_name, teamId: p.team_id }; });
      setPlayers(pm);
    }

    const rows: any[] = [];
    if (g.length > 0) {
      const groupIds = g.map(x => x.id);
      const [scoreRes, groupResults] = await Promise.all([
        supabase
          .from('tournament_hole_scores')
          .select('tournament_player_id, hole_number, gross_score')
          .in('tournament_group_id', groupIds),
        supabase
          .from('tournament_hole_results')
          .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
          .in('tournament_group_id', groupIds),
      ]);
      const map: Record<string, Record<number, number>> = {};
      (scoreRes.data || []).forEach(s => {
        if (s.gross_score == null) return;
        map[s.tournament_player_id] = map[s.tournament_player_id] || {};
        map[s.tournament_player_id][s.hole_number] = s.gross_score;
      });
      setScores(map);
      rows.push(...(groupResults.data || []));
    } else {
      setScores({});
    }

    if (m.length > 0) {
      const { data } = await supabase
        .from('tournament_hole_results')
        .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
        .in('tournament_match_id', m.map(x => x.id));
      rows.push(...(data || []));
    }
    setResults(rows as any);
    setIsLoading(false);
  }, [roundId]);

  useEffect(() => { load(); }, [load]);

  const handleRecheck = async () => {
    if (!roundId) return;
    setIsBusy(true);
    try {
      await recalcTestRoundResults(roundId);
      await load();
      toast.success('Results recalculated');
    } catch {
      toast.error('Failed to recalculate results');
    } finally {
      setIsBusy(false);
    }
  };

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const courseHoles: { number: number; par: number }[] = (round?.course_data?.holes || []).map((h: any) => ({
    number: h.number,
    par: h.par,
  }));
  const pointsPerHole = Number(game?.default_points_per_hole) || 1;
  const bestBall = !!game?.game_type?.includes('best_ball');
  const roundLabel = round?.name || `Round ${round?.round_number ?? ''}`;

  const teamOfPlayer = (id: string) => players[id]?.teamId ?? null;

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to test console"
            onClick={() => navigate(`/tournament-admin/${tournamentId}/test/${roundId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Test Scorecard & Results</h1>
            <p className="text-xs text-muted-foreground truncate">{roundLabel}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRecheck} disabled={isBusy}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recheck
          </Button>
        </div>

        {roundId && (
          <TestRoundBanner
            tournamentRoundId={roundId}
            tournamentId={tournamentId}
            resetRedirect={`/tournament-admin/${tournamentId}`}
          />
        )}

        {groups.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No test is running for this round.
            </CardContent>
          </Card>
        ) : matches.length > 0 ? (
          matches.map(m => {
            const teamAId = m.teamAId || teamOfPlayer(m.sideA[0]);
            const teamBId = m.teamBId || teamOfPlayer(m.sideB[0]);
            const sectionPlayers = [
              ...m.sideA.map(id => ({ id, name: players[id]?.name || 'Player', teamId: teamAId })),
              ...m.sideB.map(id => ({ id, name: players[id]?.name || 'Player', teamId: teamBId })),
            ];
            return (
              <TestScorecardSection
                key={m.id}
                title={`Match ${m.matchNumber}`}
                subtitle={`${m.sideA.map(id => players[id]?.name || 'Player').join(' & ')} vs ${m.sideB.map(id => players[id]?.name || 'Player').join(' & ')}`}
                players={sectionPlayers}
                teams={teams}
                teamAId={teamAId}
                teamBId={teamBId}
                courseHoles={courseHoles}
                scores={scores}
                results={results.filter(r => r.tournament_match_id === m.id)}
                pointsPerHole={pointsPerHole}
                bestBall={bestBall}
              />
            );
          })
        ) : (
          groups.map(g => {
            const teamIds = Array.from(new Set(g.players.map(p => p.team_id).filter(Boolean)));
            return (
              <TestScorecardSection
                key={g.id}
                title={`Group ${g.group_number}`}
                players={g.players.map(p => ({
                  id: p.tournament_player_id,
                  name: p.display_name,
                  teamId: p.team_id,
                }))}
                teams={teams}
                teamAId={teamIds[0]}
                teamBId={teamIds[1]}
                courseHoles={courseHoles}
                scores={scores}
                results={results.filter(r => r.tournament_group_id === g.id)}
                pointsPerHole={pointsPerHole}
                bestBall={bestBall}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${roundId}/group/${g.id}?test=1`)}
                  >
                    <ClipboardList className="w-3.5 h-3.5 mr-1" /> Enter scores
                  </Button>
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default TournamentAdminTestScorecard;
