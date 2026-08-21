import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import {
  calcTeamTotals,
  calcTeamTotalsPerRound,
  calcPlayerGrossPerRound,
  calcPlayerNetPerRound,
  calcPlayerPointsPerRound,
  calcRoundTeamAward,
} from '@/services/scoreboardCalculations';
import {
  isRoundLevelGameType,
  recalcRoundLevelResults,
  recalcRoundMatchResults,
  fetchRoundMatches,
} from '@/services/roundLevelScoring';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  tournament: any;
  teams: any[];
  players: any[];
  rounds: any[];
  games: any[];
  groups: any[];
  groupPlayers: any[];
}

const RoundResultsDashboard: React.FC<Props> = ({
  tournament, teams, players, rounds, games, groups, groupPlayers,
}) => {
  const [holeScores, setHoleScores] = useState<any[]>([]);
  const [holeResults, setHoleResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcRoundId, setRecalcRoundId] = useState<string | null>(null);

  // Completed or active rounds (show results for both)
  const completedRounds = rounds.filter((r: any) => r.status === 'completed' || r.status === 'active');

  const fetchData = useCallback(async () => {
    const allGroupIds = groups.map((g: any) => g.id);
    if (allGroupIds.length === 0) { setLoading(false); return; }

    const [scoresRes, resultsRes] = await Promise.all([
      supabase.from('tournament_hole_scores').select('*').in('tournament_group_id', allGroupIds),
      supabase.from('tournament_hole_results').select('*').eq('is_test', false).in('tournament_group_id', allGroupIds),
    ]);

    setHoleScores(scoresRes.data || []);
    setHoleResults(resultsRes.data || []);
    setLoading(false);
  }, [groups]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRecalc = async (round: any) => {
    setRecalcRoundId(round.id);
    try {
      const matches = await fetchRoundMatches(round.id, { isTest: false });
      const gameType = games.find((g: any) => g.tournament_round_id === round.id)?.game_type;
      if (matches.length > 0) {
        await recalcRoundMatchResults(round.id, { isTest: false });
      } else if (isRoundLevelGameType(gameType)) {
        await recalcRoundLevelResults(round.id, { isTest: false });
      } else {
        toast.info('This round is scored per foursome — nothing to pool.');
        setRecalcRoundId(null);
        return;
      }
      await fetchData();
      toast.success('Results recalculated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to recalculate results');
    } finally {
      setRecalcRoundId(null);
    }
  };


  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading results…</div>;
  }

  if (completedRounds.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground text-sm">No rounds have been completed or started yet.</p>
      </Card>
    );
  }

  const teamIds = teams.map((t: any) => t.id);

  // Build lookup maps
  const groupsByRound: Record<string, any[]> = {};
  groups.forEach((g: any) => {
    if (!groupsByRound[g.tournament_round_id]) groupsByRound[g.tournament_round_id] = [];
    groupsByRound[g.tournament_round_id].push(g);
  });

  const groupPlayersByGroup: Record<string, any[]> = {};
  groupPlayers.forEach((gp: any) => {
    if (!groupPlayersByGroup[gp.tournament_group_id]) groupPlayersByGroup[gp.tournament_group_id] = [];
    groupPlayersByGroup[gp.tournament_group_id].push(gp);
  });

  // Per-round raw hole-point totals
  const roundTotals = calcTeamTotalsPerRound(
    completedRounds,
    groupsByRound,
    holeResults,
    teamIds,
  );

  const method = tournament?.team_scoring_method as any;
  const awardApplies = teamIds.length === 2 && (method === 'custom_pts_per_round' || method === 'round_win');
  const pair: [string, string] | null = awardApplies ? [teamIds[0], teamIds[1]] : null;

  const holeResultsForRound = (roundId: string) => {
    const ids = new Set((groupsByRound[roundId] || []).map((g: any) => g.id));
    return holeResults.filter((r: any) => r.tournament_group_id && ids.has(r.tournament_group_id));
  };

  // Award (Front/Back/Overall or round win) per round — only for completed rounds
  const roundAwards: Record<string, Record<string, number>> = {};
  completedRounds.forEach((r: any) => {
    if (!pair) return;
    if (r.status !== 'completed') return;
    roundAwards[r.id] = calcRoundTeamAward(
      r,
      roundTotals[r.id] || {},
      holeResultsForRound(r.id) as any,
      pair,
      method,
      tournament?.custom_round_points ?? undefined,
      true,
    );
  });

  const segmentSums = (roundId: string, from: number, to: number) => {
    let a = 0, b = 0;
    if (!pair) return [a, b] as const;
    holeResultsForRound(roundId).forEach((r: any) => {
      if (r.hole_number >= from && r.hole_number <= to) {
        const tp = (r.team_points || {}) as Record<string, number>;
        a += Number(tp[pair[0]] || 0);
        b += Number(tp[pair[1]] || 0);
      }
    });
    return [a, b] as const;
  };

  const fmt = (n: number) => Number(n.toFixed(2));

  const segmentWinnerLabel = (a: number, b: number, value: number) => {
    if (a === b) return `halved · ${fmt(value / 2)} each`;
    const winner = a > b ? teams.find((t: any) => t.id === pair![0]) : teams.find((t: any) => t.id === pair![1]);
    return `${winner?.name || 'Team'} +${fmt(value)}`;
  };

  // Cumulative standings — awarded points where an award applies, raw hole points otherwise
  const cumulativeTotals: Record<string, number> = {};
  teamIds.forEach(id => { cumulativeTotals[id] = 0; });
  completedRounds.forEach((r: any) => {
    const src = roundAwards[r.id] || roundTotals[r.id] || {};
    teamIds.forEach(id => { cumulativeTotals[id] += Number(src[id] || 0); });
  });
  const maxCumulative = Math.max(...Object.values(cumulativeTotals), 1);
  const sortedTeams = [...teams].sort((a, b) => (cumulativeTotals[b.id] || 0) - (cumulativeTotals[a.id] || 0));
  const leadingTeamId = sortedTeams[0]?.id;


  return (
    <div className="space-y-4">
      {/* Grand Totals */}
      {teams.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
              Tournament Standings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTeams.map((team, idx) => {
              const pts = cumulativeTotals[team.id] || 0;
              const pct = maxCumulative > 0 ? (pts / maxCumulative) * 100 : 0;
              const isLeading = team.id === leadingTeamId && pts > 0;
              const isTrailing = idx === sortedTeams.length - 1 && sortedTeams.length > 1 && pts < (cumulativeTotals[leadingTeamId] || 0);
              return (
                <div key={team.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-medium">{team.name}</span>
                      {isLeading && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 border-[hsl(var(--brand-gold))] text-[hsl(var(--brand-gold))]">
                          <TrendingUp className="w-3 h-3 mr-0.5" /> Leading
                        </Badge>
                      )}
                      {isTrailing && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                          <TrendingDown className="w-3 h-3 mr-0.5" /> Trailing
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold tabular-nums">{pts}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Per-Round Accordion */}
      <Accordion type="multiple" defaultValue={completedRounds.map(r => r.id)}>
        {completedRounds.map((round: any) => {
          const game = games.find((g: any) => g.tournament_round_id === round.id);
          const roundGroups = groupsByRound[round.id] || [];
          const roundGroupIds = new Set(roundGroups.map((g: any) => g.id));
          const submittedCount = roundGroups.filter((g: any) => g.status === 'submitted').length;

          // Team totals for this round (raw hole points) and the awarded points
          const teamTotalsThisRound = roundTotals[round.id] || {};
          const award = roundAwards[round.id];
          const displayTotals = award || teamTotalsThisRound;
          const roundSortedTeams = [...teams].sort(
            (a, b) => (displayTotals[b.id] || 0) - (displayTotals[a.id] || 0),
          );
          const roundWinner = roundSortedTeams[0];
          const roundWinnerPts = displayTotals[roundWinner?.id] || 0;


          // Player data for this round
          const roundPlayers = players.filter((p: any) => {
            return roundGroups.some((g: any) =>
              (groupPlayersByGroup[g.id] || []).some((gp: any) => gp.tournament_player_id === p.id)
            );
          });

          const playerRows = roundPlayers.map((p: any) => {
            const gross = calcPlayerGrossPerRound(
              p.id, round.id,
              groups, groupPlayersByGroup, holeScores,
            );
            const net = calcPlayerNetPerRound(
              p, round, game,
              groups, groupPlayersByGroup, holeScores,
            );
            const pts = calcPlayerPointsPerRound(
              p.id, round.id,
              groups, groupPlayersByGroup, holeResults,
            );
            const team = teams.find((t: any) => t.id === p.team_id);
            return { player: p, team, gross, net, pts };
          }).sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1));

          return (
            <AccordionItem key={round.id} value={round.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left w-full pr-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{round.name || `Round ${round.round_number}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {game?.game_type?.replace(/_/g, ' ') || 'No game'}
                      {round.round_date && ` • ${format(new Date(round.round_date), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                  <Badge className={round.status === 'completed' ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'}>
                    {round.status === 'completed' ? 'Complete' : `${submittedCount}/${roundGroups.length}`}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {/* Team Results for this round */}
                {teams.length >= 2 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Results</p>
                    <div className="grid grid-cols-2 gap-2">
                      {roundSortedTeams.map((team, idx) => {
                        const pts = teamTotalsThisRound[team.id] || 0;
                        const isWinner = idx === 0 && pts > 0 && pts > (teamTotalsThisRound[roundSortedTeams[1]?.id] || 0);
                        const isTied = idx === 1 && pts === roundWinnerPts && pts > 0;
                        return (
                          <Card key={team.id} className={`p-3 ${isWinner ? 'ring-2 ring-[hsl(var(--brand-gold))]/50' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                              <span className="text-sm font-medium truncate">{team.name}</span>
                              {isWinner && <Trophy className="w-3.5 h-3.5 text-[hsl(var(--brand-gold))]" />}
                              {isTied && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            <p className="text-xl font-bold tabular-nums">{pts}</p>
                            <p className="text-xs text-muted-foreground">points</p>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Player Leaderboard */}
                {playerRows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player Leaderboard</p>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Player</TableHead>
                            <TableHead className="text-xs text-right w-16">Gross</TableHead>
                            <TableHead className="text-xs text-right w-14">Net</TableHead>
                            <TableHead className="text-xs text-right w-14">Pts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerRows.map(({ player, team, gross, net, pts }, idx) => (
                            <TableRow key={player.id}>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && pts !== null && pts > 0 && (
                                    <Medal className="w-3.5 h-3.5 text-[hsl(var(--brand-gold))]" />
                                  )}
                                  {team && (
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                                  )}
                                  <span className="text-sm truncate">{player.display_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums py-2">
                                {gross ?? '–'}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums py-2">
                                {net ?? '–'}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums py-2">
                                {pts ?? '–'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Group Breakdown */}
                {roundGroups.length > 0 && (
                  <Accordion type="multiple">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Group Breakdown</p>
                    {roundGroups.map((group: any) => {
                      const groupResults = holeResults
                        .filter((r: any) => r.tournament_group_id === group.id)
                        .sort((a: any, b: any) => a.hole_number - b.hole_number);
                      const gPlayers = (groupPlayersByGroup[group.id] || []).map((gp: any) => {
                        const p = players.find((pl: any) => pl.id === gp.tournament_player_id);
                        return p ? { ...p, teamId: gp.team_id } : null;
                      }).filter(Boolean);

                      return (
                        <AccordionItem key={group.id} value={group.id}>
                          <AccordionTrigger className="text-sm hover:no-underline py-2">
                            <div className="flex items-center gap-2">
                              <span>Group {group.group_number}</span>
                              <Badge variant="outline" className="text-xs">
                                {group.status === 'submitted' ? 'Complete' : group.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {gPlayers.map((p: any) => p.display_name).join(', ')}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {groupResults.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">No hole results recorded yet.</p>
                            ) : (
                              <div className="rounded border overflow-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs w-12">Hole</TableHead>
                                      <TableHead className="text-xs">Result</TableHead>
                                      {teams.length >= 2 && teams.map((t: any) => (
                                        <TableHead key={t.id} className="text-xs text-right w-14">
                                          <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: t.color }} />
                                          {t.name.slice(0, 3)}
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupResults.map((r: any) => (
                                      <TableRow key={r.id}>
                                        <TableCell className="text-xs tabular-nums py-1.5">{r.hole_number}</TableCell>
                                        <TableCell className="text-xs py-1.5">{r.result_label || '–'}</TableCell>
                                        {teams.length >= 2 && teams.map((t: any) => (
                                          <TableCell key={t.id} className="text-xs text-right tabular-nums py-1.5 font-medium">
                                            {(r.team_points as Record<string, number>)?.[t.id] ?? 0}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default RoundResultsDashboard;
