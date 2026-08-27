import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';

const TournamentGroupScorecard: React.FC = () => {
  const { joinCode, roundId, groupId } = useParams<{ joinCode: string; roundId: string; groupId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [groupPlayersList, setGroupPlayersList] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [game, setGame] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/tournament/${joinCode}/round/${roundId}/group/${groupId}`)}`);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!roundId || !groupId || !user) return;
    const load = async () => {
      setLoading(true);
      const [roundRes, groupRes, gpRes, gameRes] = await Promise.all([
        supabase.from('tournament_rounds').select('*').eq('id', roundId).single(),
        supabase.from('tournament_groups').select('*').eq('id', groupId).single(),
        supabase.from('tournament_group_players').select('*').eq('tournament_group_id', groupId),
        supabase.from('tournament_games').select('*').eq('tournament_round_id', roundId).single(),
      ]);

      setRound(roundRes.data);
      setGroup(groupRes.data);
      setGroupPlayersList(gpRes.data || []);
      setGame(gameRes.data);

      if (roundRes.data) {
        const [teamsRes, playersRes] = await Promise.all([
          supabase.from('tournament_teams').select('*').eq('tournament_id', roundRes.data.tournament_id),
          supabase.from('tournament_players').select('*').eq('tournament_id', roundRes.data.tournament_id),
        ]);
        setTeams(teamsRes.data || []);
        setPlayers(playersRes.data || []);
      }

      const [scoresRes, resultsRes] = await Promise.all([
        supabase.from('tournament_hole_scores').select('*').eq('tournament_group_id', groupId),
        supabase.from('tournament_hole_results').select('*').eq('tournament_group_id', groupId),
      ]);
      setScores(scoresRes.data || []);
      setResults(resultsRes.data || []);
      setLoading(false);
    };
    load();
  }, [roundId, groupId, user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!round || !group) {
    return (
      <div className="min-h-screen bg-background p-4">
        <p className="text-center text-muted-foreground">Group not found.</p>
      </div>
    );
  }

  const courseHoles: any[] = round.course_data?.holes || [];
  const matchup = group.team_matchup as { teamAId: string; teamBId: string } | null;
  const teamA = matchup ? teams.find((t: any) => t.id === matchup.teamAId) : null;
  const teamB = matchup ? teams.find((t: any) => t.id === matchup.teamBId) : null;

  const groupPlayersInGroup = groupPlayersList;
  const teamAPlayers = groupPlayersInGroup.filter((gp: any) => gp.team_id === teamA?.id);
  const teamBPlayers = groupPlayersInGroup.filter((gp: any) => gp.team_id === teamB?.id);

  const getPlayer = (playerId: string) => players.find((p: any) => p.id === playerId);
  const getScore = (playerId: string, hole: number) => {
    const s = scores.find((s: any) => s.tournament_player_id === playerId && s.hole_number === hole);
    return s?.gross_score ?? null;
  };
  const getResult = (hole: number) => results.find((r: any) => r.hole_number === hole);

  // Team totals
  const teamTotals: Record<string, number> = {};
  if (teamA) teamTotals[teamA.id] = 0;
  if (teamB) teamTotals[teamB.id] = 0;
  results.forEach((r: any) => {
    const tp = r.team_points as Record<string, number>;
    if (tp) {
      Object.entries(tp).forEach(([tid, pts]) => {
        teamTotals[tid] = (teamTotals[tid] || 0) + Number(pts);
      });
    }
  });

  const frontNine = courseHoles.filter((h: any) => h.number <= 9);
  const backNine = courseHoles.filter((h: any) => h.number > 9);

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <div className="p-4 space-y-3">
        {group.is_test && (
          <TestRoundBanner
            tournamentRoundId={group.tournament_round_id}
            tournamentId={round.tournament_id}
          />
        )}
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Scoreboards
        </Button>
      </div>

      <div className="px-4 pb-8 space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold">
            {round.name || `Round ${round.round_number}`} — Group {group.group_number}
          </h2>
        </div>

        {/* Match Status Bar */}
        {teamA && teamB && (() => {
          const totalA = teamTotals[teamA.id] || 0;
          const totalB = teamTotals[teamB.id] || 0;
          const holesPlayed = results.length;
          const pointsPerHole = game?.default_points_per_hole || 1;
          const totalPointsAvailable = 18 * pointsPerHole;
          const pointsUsed = totalA + totalB;
          const remaining = Math.max(0, totalPointsAvailable - pointsUsed);
          const isMatchComplete = group.status === 'submitted' || holesPlayed >= 18 ||
            (totalA > totalB && (totalA - totalB) > remaining) ||
            (totalB > totalA && (totalB - totalA) > remaining);
          const isDormie = !isMatchComplete && remaining > 0 &&
            Math.abs(totalA - totalB) === remaining;

          let statusLine = '';
          const winnerName = totalA > totalB ? teamA.name : teamB.name;
          if (isMatchComplete) {
            statusLine = totalA === totalB
              ? `Match Halved ${totalA} — ${totalB}`
              : `${winnerName} wins ${Math.max(totalA, totalB)} — ${Math.min(totalA, totalB)}`;
          } else if (isDormie) {
            statusLine = `Dormie • ${remaining} pts left`;
          } else if (totalA === totalB) {
            statusLine = `All Square • Thru ${holesPlayed} • ${remaining} pts left`;
          } else {
            statusLine = `${winnerName} leads • Thru ${holesPlayed} • ${remaining} pts left`;
          }

          return (
            <div className="space-y-2">
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA.color }} />
                    <span className={`font-semibold text-sm ${totalA >= totalB ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {teamA.name}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-foreground font-mono">
                    {totalA}
                    <span className="text-muted-foreground text-lg"> — </span>
                    {totalB}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${totalB >= totalA ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {teamB.name}
                    </span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB.color }} />
                  </div>
                </div>
                <p className={`text-xs text-center ${isMatchComplete ? 'text-[hsl(var(--brand-gold))] font-bold' : 'text-muted-foreground'}`}>
                  {statusLine}
                </p>
              </div>

              {isMatchComplete && (
                <div className="rounded-xl border p-3 text-center text-sm font-bold"
                  style={{
                    backgroundColor: 'hsl(45 93% 47% / 0.15)',
                    borderColor: 'hsl(45 93% 47% / 0.4)',
                    color: 'hsl(45 93% 47%)',
                  }}
                >
                  Match Complete 🏆{' '}
                  {totalA === totalB
                    ? `Match Halved ${totalA} — ${totalB}`
                    : `${winnerName} wins ${Math.max(totalA, totalB)}pts to ${Math.min(totalA, totalB)}pts`}
                </div>
              )}

              {/* Hole result dots */}
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {courseHoles.map((h: any) => {
                  const res = results.find((r: any) => r.hole_number === h.number);
                  if (!res) return <span key={h.number} className="w-3 h-3 rounded-full bg-muted border border-border" />;
                  const tp = res.team_points as Record<string, number>;
                  const aPts = Number(tp?.[teamA.id] || 0);
                  const bPts = Number(tp?.[teamB.id] || 0);
                  const color = aPts > bPts ? teamA.color : bPts > aPts ? teamB.color : undefined;
                  return (
                    <span
                      key={h.number}
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: color || 'hsl(var(--muted))' }}
                      title={`Hole ${h.number}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Scorecard table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-1.5 text-left font-medium text-muted-foreground">Hole</th>
                  {frontNine.map((h: any) => (
                    <th key={h.number} className="p-1.5 text-center w-8 font-mono">{h.number}</th>
                  ))}
                  <th className="p-1.5 text-center w-8 font-bold bg-muted/50">OUT</th>
                  {backNine.map((h: any) => (
                    <th key={h.number} className="p-1.5 text-center w-8 font-mono">{h.number}</th>
                  ))}
                  <th className="p-1.5 text-center w-8 font-bold bg-muted/50">IN</th>
                  <th className="p-1.5 text-center w-8 font-bold bg-muted/50">TOT</th>
                </tr>
                <tr className="border-b text-muted-foreground">
                  <td className="p-1.5 text-left">Par</td>
                  {frontNine.map((h: any) => <td key={h.number} className="p-1.5 text-center font-mono">{h.par}</td>)}
                  <td className="p-1.5 text-center font-mono bg-muted/50">{frontNine.reduce((s: number, h: any) => s + h.par, 0)}</td>
                  {backNine.map((h: any) => <td key={h.number} className="p-1.5 text-center font-mono">{h.par}</td>)}
                  <td className="p-1.5 text-center font-mono bg-muted/50">{backNine.reduce((s: number, h: any) => s + h.par, 0)}</td>
                  <td className="p-1.5 text-center font-mono bg-muted/50">{courseHoles.reduce((s: number, h: any) => s + h.par, 0)}</td>
                </tr>
              </thead>
              <tbody>
                {/* Player rows */}
                {[...teamAPlayers, ...teamBPlayers].map((gp: any) => {
                  const p = getPlayer(gp.tournament_player_id);
                  const team = teams.find((t: any) => t.id === gp.team_id);
                  if (!p) return null;
                  return (
                    <tr key={gp.id} className="border-b">
                      <td className="p-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {team && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />}
                          <span className="font-medium truncate max-w-[80px]">{p.display_name}</span>
                        </div>
                      </td>
                      {frontNine.map((h: any) => {
                        const score = getScore(p.id, h.number);
                        return (
                          <td key={h.number} className={`p-1.5 text-center font-mono ${score != null && score < h.par ? 'text-destructive font-bold' : score != null && score > h.par ? 'text-muted-foreground' : ''}`}>
                            {score ?? ''}
                          </td>
                        );
                      })}
                      <td className="p-1.5 text-center font-mono font-bold bg-muted/50">
                        {frontNine.reduce((s: number, h: any) => s + (getScore(p.id, h.number) || 0), 0) || ''}
                      </td>
                      {backNine.map((h: any) => {
                        const score = getScore(p.id, h.number);
                        return (
                          <td key={h.number} className={`p-1.5 text-center font-mono ${score != null && score < h.par ? 'text-destructive font-bold' : score != null && score > h.par ? 'text-muted-foreground' : ''}`}>
                            {score ?? ''}
                          </td>
                        );
                      })}
                      <td className="p-1.5 text-center font-mono font-bold bg-muted/50">
                        {backNine.reduce((s: number, h: any) => s + (getScore(p.id, h.number) || 0), 0) || ''}
                      </td>
                      <td className="p-1.5 text-center font-mono font-bold bg-muted/50">
                        {courseHoles.reduce((s: number, h: any) => s + (getScore(p.id, h.number) || 0), 0) || ''}
                      </td>
                    </tr>
                  );
                })}

                {/* Result row */}
                {teamA && teamB && (
                  <tr className="border-t-2 bg-muted/20">
                    <td className="p-1.5 font-medium text-muted-foreground">Result</td>
                    {frontNine.map((h: any) => {
                      const res = getResult(h.number);
                      if (!res) return <td key={h.number} className="p-1.5 text-center">—</td>;
                      const tp = res.team_points as Record<string, number>;
                      const aPts = Number(tp?.[teamA.id] || 0);
                      const bPts = Number(tp?.[teamB.id] || 0);
                      return (
                        <td key={h.number} className="p-1.5 text-center">
                          {aPts > bPts ? (
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teamA.color }} />
                          ) : bPts > aPts ? (
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teamB.color }} />
                          ) : aPts > 0 ? (
                            <span className="text-xs text-muted-foreground">½</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1.5 text-center bg-muted/50 font-mono font-bold">
                      {/* Front 9 team totals not shown separately */}
                    </td>
                    {backNine.map((h: any) => {
                      const res = getResult(h.number);
                      if (!res) return <td key={h.number} className="p-1.5 text-center">—</td>;
                      const tp = res.team_points as Record<string, number>;
                      const aPts = Number(tp?.[teamA.id] || 0);
                      const bPts = Number(tp?.[teamB.id] || 0);
                      return (
                        <td key={h.number} className="p-1.5 text-center">
                          {aPts > bPts ? (
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teamA.color }} />
                          ) : bPts > aPts ? (
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: teamB.color }} />
                          ) : aPts > 0 ? (
                            <span className="text-xs text-muted-foreground">½</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1.5 text-center bg-muted/50" />
                    <td className="p-1.5 text-center bg-muted/50 font-mono font-bold">
                      <span style={{ color: teamA.color }}>{teamTotals[teamA.id] || 0}</span>
                      <span className="text-muted-foreground mx-0.5">-</span>
                      <span style={{ color: teamB.color }}>{teamTotals[teamB.id] || 0}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TournamentGroupScorecard;
