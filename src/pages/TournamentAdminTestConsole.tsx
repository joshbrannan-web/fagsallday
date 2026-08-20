import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, ClipboardList, Dices, RefreshCw, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';
import {
  fetchTestGroupSummaries, fillTestRoundScores, recalcTestRoundResults, type TestGroupSummary,
} from '@/services/testRounds';
import { fetchRoundMatches, isRoundLevelGameType, type RoundMatch } from '@/services/roundLevelScoring';
import { toast } from 'sonner';

interface HoleResultRow {
  hole_number: number;
  team_points: Record<string, number> | null;
  result_label: string | null;
  tournament_group_id: string | null;
  tournament_match_id: string | null;
}

const TournamentAdminTestConsole: React.FC = () => {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();

  const [groups, setGroups] = useState<TestGroupSummary[]>([]);
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  const [round, setRound] = useState<any>(null);
  const [thru, setThru] = useState<Record<string, number>>({});
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Record<string, { name: string; color: string }>>({});
  const [results, setResults] = useState<HoleResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilling, setIsFilling] = useState(false);

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
      const [tpRes, teamRes] = await Promise.all([
        supabase.from('tournament_players').select('id, display_name').eq('tournament_id', rRes.data.tournament_id),
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', rRes.data.tournament_id),
      ]);
      const names: Record<string, string> = {};
      (tpRes.data || []).forEach(p => { names[p.id] = p.display_name; });
      setPlayerNames(names);
      const tm: Record<string, { name: string; color: string }> = {};
      (teamRes.data || []).forEach(t => { tm[t.id] = { name: t.name, color: t.color }; });
      setTeams(tm);
    }

    const resultRows: HoleResultRow[] = [];

    if (g.length > 0) {
      const groupIds = g.map(x => x.id);
      const [scoresRes, groupResultsRes] = await Promise.all([
        supabase
          .from('tournament_hole_scores')
          .select('tournament_group_id, hole_number, gross_score')
          .in('tournament_group_id', groupIds),
        supabase
          .from('tournament_hole_results')
          .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
          .in('tournament_group_id', groupIds),
      ]);
      const counts: Record<string, number> = {};
      g.forEach(x => {
        const holes = new Set(
          (scoresRes.data || [])
            .filter(s => s.tournament_group_id === x.id && s.gross_score !== null)
            .map(s => s.hole_number),
        );
        counts[x.id] = holes.size;
      });
      setThru(counts);
      resultRows.push(...((groupResultsRes.data || []) as any[]));
    }

    if (m.length > 0) {
      const { data: matchResults } = await supabase
        .from('tournament_hole_results')
        .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
        .in('tournament_match_id', m.map(x => x.id));
      resultRows.push(...((matchResults || []) as any[]));
    }

    setResults(resultRows);
    setIsLoading(false);
  }, [roundId]);

  useEffect(() => { load(); }, [load]);

  const handleFill = async (groupId?: string) => {
    if (!roundId) return;
    setIsFilling(true);
    try {
      const n = await fillTestRoundScores(roundId, groupId ? { groupId } : undefined);
      if (n === 0) toast.error('Nothing to fill — no test players or course holes found');
      else toast.success(`Filled ${n} random scores — results recalculated`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to fill test scores');
    } finally {
      setIsFilling(false);
    }
  };

  const handleRecheck = async () => {
    if (!roundId) return;
    setIsFilling(true);
    try {
      await recalcTestRoundResults(roundId);
      await load();
      toast.success('Results recalculated');
    } catch {
      toast.error('Failed to recalculate results');
    } finally {
      setIsFilling(false);
    }
  };

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const roundLabel = round?.name || `Round ${round?.round_number ?? ''}`;

  const totalsFor = (rows: HoleResultRow[]) => {
    const totals: Record<string, number> = {};
    rows.forEach(r => {
      Object.entries(r.team_points || {}).forEach(([teamId, pts]) => {
        totals[teamId] = (totals[teamId] || 0) + (Number(pts) || 0);
      });
    });
    return totals;
  };

  const renderResultBlock = (label: string, rows: HoleResultRow[]) => {
    const sorted = [...rows].sort((a, b) => a.hole_number - b.hole_number);
    const totals = totalsFor(sorted);
    return (
      <div key={label} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{label}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals).map(([teamId, pts]) => (
              <Badge
                key={teamId}
                variant="outline"
                style={teams[teamId]?.color ? { borderColor: teams[teamId].color } : undefined}
              >
                {teams[teamId]?.name || 'Team'}: {Number(pts.toFixed(2))}
              </Badge>
            ))}
            {Object.keys(totals).length === 0 && (
              <span className="text-xs text-muted-foreground">No points yet</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {sorted.map(r => (
            <span
              key={r.hole_number}
              title={`Hole ${r.hole_number}: ${r.result_label || '—'}`}
              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {r.hole_number}: {r.result_label || '—'}
            </span>
          ))}
          {sorted.length === 0 && (
            <span className="text-xs text-muted-foreground">No hole results recorded yet.</span>
          )}
        </div>
      </div>
    );
  };

  const hasResults = results.length > 0;

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
            <div className="flex flex-wrap items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isFilling}>
                    <Dices className="w-4 h-4 mr-1" />
                    {isFilling ? 'Working…' : 'Fill All Scores'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Randomly fill every hole for every test group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every player in this test round gets a random score on every hole, overwriting
                      any test scores already entered. Results are recalculated with the round's real
                      scoring rules. Real tournament data is untouched.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFill()}>Fill Scores</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" onClick={handleRecheck} disabled={isFilling}>
                <RefreshCw className="w-4 h-4 mr-1" /> Recheck results
              </Button>

              <Button
                variant="secondary"
                onClick={() => navigate(`/tournament-admin/${tournamentId}/test/${roundId}/scorecard`)}
              >
                <ClipboardList className="w-4 h-4 mr-1" /> View Scorecard & Results
              </Button>
            </div>

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
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleFill(g.id)} disabled={isFilling}>
                      <Dices className="w-3.5 h-3.5 mr-1" /> Fill
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/tournament-admin/${tournamentId}/test/${roundId}/scorecard`)}
                    >
                      <Table2 className="w-3.5 h-3.5 mr-1" /> Scorecard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${roundId}/group/${g.id}?test=1`)}
                    >
                      <ClipboardList className="w-3.5 h-3.5 mr-1" /> Enter scores
                    </Button>
                  </div>
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

            {hasResults && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Test results</p>
                  {matches.length > 0
                    ? matches.map(m =>
                        renderResultBlock(
                          `M${m.matchNumber}: ${m.sideA.map(id => playerNames[id] || 'Player').join(' & ')} vs ${m.sideB.map(id => playerNames[id] || 'Player').join(' & ')}`,
                          results.filter(r => r.tournament_match_id === m.id),
                        ),
                      )
                    : groups
                        .filter(g => results.some(r => r.tournament_group_id === g.id))
                        .map(g =>
                          renderResultBlock(
                            `Group ${g.group_number}`,
                            results.filter(r => r.tournament_group_id === g.id),
                          ),
                        )}
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
