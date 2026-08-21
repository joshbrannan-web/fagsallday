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
import TestRoundAwardCard from '@/components/tournament-admin/TestRoundAwardCard';
import { calcRoundTeamAward } from '@/services/scoreboardCalculations';
import { toast } from 'sonner';

const TournamentAdminTestScorecard: React.FC = () => {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [round, setRound] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [groups, setGroups] = useState<TestGroupSummary[]>([]);
  const [matches, setMatches] = useState<RoundMatch[]>([]);
  const [teams, setTeams] = useState<Record<string, { name: string; color: string }>>({});
  const [players, setPlayers] = useState<Record<string, { name: string; teamId: string | null; handicap: number }>>({});
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
      const [teamRes, playerRes, tRes] = await Promise.all([
        supabase.from('tournament_teams').select('id, name, color').eq('tournament_id', roundRes.data.tournament_id),
        supabase.from('tournament_players').select('id, display_name, team_id, handicap_index, handicap_override').eq('tournament_id', roundRes.data.tournament_id),
        supabase.from('tournaments').select('team_scoring_method, custom_round_points').eq('id', roundRes.data.tournament_id).maybeSingle(),
      ]);
      setTournament(tRes.data);
      const tm: Record<string, { name: string; color: string }> = {};
      (teamRes.data || []).forEach(t => { tm[t.id] = { name: t.name, color: t.color }; });
      setTeams(tm);
      const pm: Record<string, { name: string; teamId: string | null; handicap: number }> = {};
      (playerRes.data || []).forEach((p: any) => { pm[p.id] = { name: p.display_name, teamId: p.team_id, handicap: Number(p.handicap_override ?? p.handicap_index ?? 0) }; });
      setPlayers(pm);
    }

    const groupIds = g.map(x => x.id);
    const matchIds = m.map(x => x.id);

    const fetchResults = async () => {
      const rows: any[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase
          .from('tournament_hole_results')
          .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
          .in('tournament_group_id', groupIds);
        rows.push(...(data || []));
      }
      if (matchIds.length > 0) {
        const { data } = await supabase
          .from('tournament_hole_results')
          .select('hole_number, team_points, result_label, tournament_group_id, tournament_match_id')
          .in('tournament_match_id', matchIds);
        rows.push(...(data || []));
      }
      return rows;
    };

    let hasScores = false;
    if (groupIds.length > 0) {
      const { data: scoreRows } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_player_id, hole_number, gross_score')
        .in('tournament_group_id', groupIds);
      const map: Record<string, Record<number, number>> = {};
      (scoreRows || []).forEach(s => {
        if (s.gross_score == null) return;
        map[s.tournament_player_id] = map[s.tournament_player_id] || {};
        map[s.tournament_player_id][s.hole_number] = s.gross_score;
      });
      hasScores = Object.keys(map).length > 0;
      setScores(map);
    } else {
      setScores({});
    }

    let rows = await fetchResults();

    // Self-heal: scores exist but nothing has been calculated yet (e.g. matches
    // were mirrored in after the test started). Derive results once.
    if (rows.length === 0 && hasScores && !autoHealed.current) {
      autoHealed.current = true;
      try {
        await recalcTestRoundResults(roundId);
        rows = await fetchResults();
      } catch {
        // leave results empty; the UI shows a "not calculated" state
      }
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

  const courseHoles: { number: number; par: number }[] = (round?.course_data?.holes || []).map((h: any, i: number) => ({
    number: h.number ?? i + 1,
    par: h.par ?? 4,
  }));
  const holeStrokeIndex: Record<number, number> = {};
  (round?.course_data?.holes || []).forEach((h: any, i: number) => {
    holeStrokeIndex[h.number ?? i + 1] = Number(h.handicapIndex ?? h.handicap ?? h.si ?? i + 1);
  });
  const playerHandicaps: Record<string, number> = Object.fromEntries(
    Object.entries(players).map(([id, p]: any) => [id, p.handicap ?? 0]),
  );
  const useHandicaps = game?.use_handicaps ?? true;
  const handicapAllowancePercent = Number(game?.handicap_allowance_percent ?? 100);
  const strokeProps = {
    handicaps: playerHandicaps,
    holeStrokeIndex,
    useHandicaps,
    handicapAllowancePercent,
  };
  const pointsPerHole = Number(game?.default_points_per_hole) || 1;
  const bestBall = !!game?.game_type?.includes('best_ball');
  const roundLabel = round?.name || `Round ${round?.round_number ?? ''}`;
  const ballsCounted = bestBall ? (hole: number) => scoresNeeded(hole) : undefined;

  const teamOfPlayer = (id: string) => players[id]?.teamId ?? null;

  // Round-level formats pool every player on each team across all foursomes and
  // store one consolidated result set on the anchor group (lowest group number).
  const isRoundLevel = matches.length === 0 && isRoundLevelGameType(game?.game_type) && groups.length > 0;
  const anchorGroupId = groups[0]?.id;
  const roundLevelPlayers = groups.flatMap(g =>
    g.players.map(p => ({ id: p.tournament_player_id, name: p.display_name, teamId: p.team_id })),
  );
  const roundLevelTeamIds = Array.from(new Set(roundLevelPlayers.map(p => p.teamId).filter(Boolean))) as string[];
  const rosterFor = (tid: string) =>
    roundLevelPlayers.filter(p => p.teamId === tid).map(p => p.name).join(', ');

  const awardTeamIds = (roundLevelTeamIds.length === 2
    ? roundLevelTeamIds
    : Array.from(new Set(groups.flatMap(g => g.players.map(p => p.team_id)).filter(Boolean)))) as string[];
  const awardResults = isRoundLevel
    ? results.filter(r => r.tournament_group_id === anchorGroupId)
    : results;
  const hasAward = awardTeamIds.length === 2 && groups.length > 0;
  const awardCard = hasAward ? (
    <TestRoundAwardCard
      round={round}
      holeResults={awardResults as any}
      teamIds={[awardTeamIds[0], awardTeamIds[1]]}
      teams={teams}
      method={tournament?.team_scoring_method}
      customRoundPoints={tournament?.custom_round_points}
      courseHoleNumbers={courseHoles.map(h => h.number)}
    />
  ) : null;

  let awardLine: string | undefined;
  if (hasAward) {
    const [ta, tb] = [awardTeamIds[0], awardTeamIds[1]];
    const totalsForAward: Record<string, number> = { [ta]: 0, [tb]: 0 };
    awardResults.forEach(r => {
      const tp = (r.team_points || {}) as Record<string, number>;
      totalsForAward[ta] += Number(tp[ta] || 0);
      totalsForAward[tb] += Number(tp[tb] || 0);
    });
    const award = calcRoundTeamAward(
      round,
      totalsForAward,
      awardResults as any,
      [ta, tb],
      tournament?.team_scoring_method,
      tournament?.custom_round_points ?? undefined,
      true,
    );
    const method = tournament?.team_scoring_method;
    if (method === 'custom_pts_per_round' || method === 'round_win') {
      awardLine = `Round award: ${teams[ta]?.name || 'Team A'} ${Number((award[ta] || 0).toFixed(2))} — ${teams[tb]?.name || 'Team B'} ${Number((award[tb] || 0).toFixed(2))}`;
    }
  }

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

        {awardCard}



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
                ballsCounted={ballsCounted}
                {...strokeProps}
              />
            );
          })
        ) : isRoundLevel ? (
          <>
            <TestScorecardSection
              title="Round match — all groups"
              subtitle={
                roundLevelTeamIds.length === 2
                  ? `${teams[roundLevelTeamIds[0]]?.name || 'Team A'} (${rosterFor(roundLevelTeamIds[0])}) vs ${teams[roundLevelTeamIds[1]]?.name || 'Team B'} (${rosterFor(roundLevelTeamIds[1])})`
                  : 'All test players pooled by team'
              }
              players={roundLevelPlayers}
              teams={teams}
              teamAId={roundLevelTeamIds[0]}
              teamBId={roundLevelTeamIds[1]}
              courseHoles={courseHoles}
              scores={scores}
              results={results.filter(r => r.tournament_group_id === anchorGroupId)}
              pointsPerHole={pointsPerHole}
              bestBall={bestBall}
              ballsCounted={ballsCounted}
              {...strokeProps}
              awardLine={awardLine}
            />
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  This format scores the whole round as one team-vs-team match, so every
                  foursome's scores feed the single result above.
                </p>
                <div className="flex flex-wrap gap-2">
                  {groups.map(g => (
                    <Button
                      key={g.id}
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${roundId}/group/${g.id}?test=1`)}
                    >
                      <ClipboardList className="w-3.5 h-3.5 mr-1" /> Group {g.group_number} scores
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
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
                ballsCounted={ballsCounted}
                {...strokeProps}
                awardLine={awardLine}
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
