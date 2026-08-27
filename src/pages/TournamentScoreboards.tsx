import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Loader2, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentScoreboards } from '@/hooks/useTournamentScoreboards';
import ScoreboardSelector from '@/components/scoreboards/ScoreboardSelector';
import ScoreboardRenderer from '@/components/scoreboards/ScoreboardRenderer';
import TournamentLiveToast from '@/components/scoreboards/TournamentLiveToast';
import { GAME_TYPE_LABELS } from '@/components/tournament/TournamentRoundCard';
import SideBetsPanel from '@/components/tournament/SideBetsPanel';


const TournamentScoreboards: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [tournamentId, setTournamentId] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string>('');
  const [autoJoined, setAutoJoined] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/tournament/${joinCode}/scoreboards`)}`);
    }
  }, [authLoading, user, joinCode, navigate]);

  // Fetch tournament by join code
  useEffect(() => {
    if (!joinCode || !user) return;
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
  }, [joinCode, user]);

  // Auto-join
  useEffect(() => {
    if (!tournamentId || !user || autoJoined) return;
    setAutoJoined(true);
    supabase
      .from('tournament_members')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          supabase.from('tournament_members').insert({ tournament_id: tournamentId, user_id: user.id });
        }
      });
  }, [tournamentId, user, autoJoined]);

  const {
    scoreboards, teams, rounds, players, groups, groupPlayers,
    holeResults, holeScores, games, isLoading, isLive, newHoleResult, customRoundPoints,
    roundMatches,
  } = useTournamentScoreboards(tournamentId);

  // Default selected scoreboard — prefer group_matches
  useEffect(() => {
    if (scoreboards.length > 0 && !selectedId) {
      const groupMatchesSb = scoreboards.find((s: any) => s.scoreboard_type === 'group_matches');
      setSelectedId(groupMatchesSb?.id || scoreboards[0].id);
    }
  }, [scoreboards, selectedId]);

  if (authLoading || !tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedScoreboard = scoreboards.find((s: any) => s.id === selectedId);
  const isComplete = tournament.status === 'completed';
  const highestActiveRound = rounds.filter((r: any) => r.status === 'active' || r.status === 'completed')
    .sort((a: any, b: any) => b.round_number - a.round_number)[0];

  // Completion banner: compute winner
  const completionBanner = (() => {
    if (!isComplete || teams.length < 2) return null;
    const totals: Record<string, number> = {};
    teams.forEach((t: any) => { totals[t.id] = 0; });
    holeResults.forEach((hr: any) => {
      const tp = hr.team_points as Record<string, number>;
      if (tp) Object.entries(tp).forEach(([tid, pts]) => { totals[tid] = (totals[tid] || 0) + Number(pts); });
    });
    const [t1, t2] = teams;
    const p1 = totals[t1.id] || 0;
    const p2 = totals[t2.id] || 0;
    if (p1 === p2) return `🏆 Tournament Complete — Tied ${p1} — ${p2}`;
    const winner = p1 > p2 ? t1 : t2;
    return `🏆 ${winner.name} wins ${Math.max(p1, p2)} — ${Math.min(p1, p2)}`;
  })();

  const scoreboardData = {
    teams, rounds, players, groups, groupPlayers,
    holeResults, holeScores, games, roundMatches,
    tournamentStatus: tournament.status,
    teamScoringMethod: (tournament as any).team_scoring_method || 'cumulative',
    customRoundPoints: customRoundPoints,
  };


  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Live toast */}
      {isLive && !isComplete && (
        <TournamentLiveToast
          newHoleResult={newHoleResult}
          teams={teams}
          players={players}
          groupPlayers={groupPlayers}
          holeResults={holeResults}
        />
      )}

      {/* Completed banner */}
      {isComplete && completionBanner && (
        <div className="bg-[hsl(var(--brand-gold))]/20 border-b border-[hsl(var(--brand-gold))]/40 px-4 py-2 text-center">
          <span className="text-sm font-bold">{completionBanner}</span>
        </div>
      )}

      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tournament')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-[hsl(var(--brand-gold))]" />
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            {isLive && !isComplete && (
              <Badge className="bg-success text-success-foreground gap-1">
                <span className="w-2 h-2 rounded-full bg-success-foreground animate-pulse" />
                Live
              </Badge>
            )}
          </div>

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

          <p className="text-sm text-muted-foreground">
            {highestActiveRound
              ? `Round ${highestActiveRound.round_number} of ${tournament.num_rounds}`
              : `Round 0 of ${tournament.num_rounds} — Not started`}
            {(tournament.start_date || tournament.end_date) && ' • '}
            {tournament.start_date && new Date(tournament.start_date).toLocaleDateString()}
            {tournament.end_date && ` — ${new Date(tournament.end_date).toLocaleDateString()}`}
          </p>
        </div>

        {/* Scoreboard selector */}
        <ScoreboardSelector
          scoreboards={scoreboards}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedScoreboard ? (
          <ScoreboardRenderer
            scoreboard={selectedScoreboard}
            data={scoreboardData}
            joinCode={joinCode || ''}
          />
        ) : scoreboards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No scoreboards configured yet.</p>
          </div>
        ) : null}

        {/* Rounds & Matchups Section */}
        {rounds.length > 0 && (
          <div className="space-y-3 mt-6">
            <h2 className="text-lg font-bold">Rounds & Matchups</h2>
            {rounds.map((round: any) => {
              const game = games[round.id];
              const roundGroups = groups[round.id] || [];
              const course = round.course_data as any;
              const courseName = course?.name || 'TBD';
              const gameType = game?.game_type;

              const started = round.status === 'active' || round.status === 'completed';
              const matchesForRound = (roundMatches || []).filter((m: any) => m.tournamentRoundId === round.id);

              return (
                <Card key={round.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Round {round.round_number}{round.name ? ` — ${round.name}` : ''}
                      </h3>
                      <Badge variant={round.status === 'active' ? 'default' : round.status === 'completed' ? 'secondary' : 'outline'}>
                        {round.status === 'active' ? 'In Progress' : round.status === 'completed' ? 'Complete' : 'Not Started'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {round.round_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(round.round_date).toLocaleDateString()}</span>
                      )}
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{courseName}</span>
                    </div>
                    {gameType && (
                      <p className="text-sm font-medium text-[hsl(var(--brand-gold))]">
                        {GAME_TYPE_LABELS[gameType] || gameType}
                        {gameType === 'match_play_best_ball' && game && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            • 2nd Ball: {game.second_ball_tiebreaker ? 'On' : 'Off'}
                          </span>
                        )}
                      </p>
                    )}

                    {started && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => navigate(`/tournament/${joinCode}/round/${round.id}/results`)}
                      >
                        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                        View Scorecard &amp; Results (Round)
                      </Button>
                    )}

                    {/* Groups/Pairings */}
                    {roundGroups.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pairings</p>
                        {roundGroups.map((group: any) => {
                          const gps = groupPlayers[group.id] || [];
                          const matchup = group.team_matchup as any;
                          const teamAPlayers = gps
                            .filter((gp: any) => matchup ? gp.team_id === matchup.teamAId : false)
                            .map((gp: any) => players.find((p: any) => p.id === gp.tournament_player_id))
                            .filter(Boolean);
                          const teamBPlayers = gps
                            .filter((gp: any) => matchup ? gp.team_id === matchup.teamBId : false)
                            .map((gp: any) => players.find((p: any) => p.id === gp.tournament_player_id))
                            .filter(Boolean);

                          const teamA = matchup ? teams.find((t: any) => t.id === matchup.teamAId) : null;
                          const teamB = matchup ? teams.find((t: any) => t.id === matchup.teamBId) : null;

                          const groupPlayerIds = new Set(gps.map((gp: any) => gp.tournament_player_id));
                          const matchForGroup = matchesForRound.find((m: any) =>
                            [...m.sideA, ...m.sideB].every((pid: string) => groupPlayerIds.has(pid)),
                          );
                          const focusQuery = matchForGroup ? `?match=${matchForGroup.id}` : `?group=${group.id}`;

                          return (
                            <div key={group.id} className="flex flex-wrap items-center gap-2 text-sm py-1 px-2 bg-muted/30 rounded">
                              <span className="text-xs text-muted-foreground font-mono">G{group.group_number}</span>
                              <div className="flex items-center gap-1">
                                {teamA && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamA.color }} />}
                                <span>{teamAPlayers.map((p: any) => p.display_name.split(' ')[0]).join(', ') || '—'}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">vs</span>
                              <div className="flex items-center gap-1">
                                {teamB && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamB.color }} />}
                                <span>{teamBPlayers.map((p: any) => p.display_name.split(' ')[0]).join(', ') || '—'}</span>
                              </div>
                              {started && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto h-7 text-xs"
                                  onClick={() => navigate(`/tournament/${joinCode}/round/${round.id}/results${focusQuery}`)}
                                >
                                  <ClipboardList className="w-3 h-3 mr-1" />
                                  View Scorecard &amp; Results (Match)
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Side Bets */}
        {tournamentId && (
          <div className="space-y-3 mt-6">
            <h2 className="text-lg font-bold">Side Bets</h2>
            <SideBetsPanel tournamentId={tournamentId} players={players} rounds={rounds} />
          </div>
        )}
      </div>

    </div>
  );
};

export default TournamentScoreboards;
