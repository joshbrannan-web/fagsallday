import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { calcTeamTotals } from '@/services/scoreboardCalculations';
import { useNavigate } from 'react-router-dom';

interface Props {
  teams: any[];
  rounds: any[];
  players: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  holeResults: any[];
  holeScores: any[];
  games: Record<string, any>;
  roundMatches?: any[];
  tournamentStatus: string;
  joinCode: string;
}

const GroupMatchesScoreboard: React.FC<Props> = ({
  teams, rounds, groups, groupPlayers, holeResults, holeScores, players, games, roundMatches = [], joinCode,
}) => {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const teamIds = teams.map(t => t.id);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  return (
    <div className="space-y-4">
      {sortedRounds.map(round => {
        const roundGroups = (groups[round.id] || []).sort((a: any, b: any) => a.group_number - b.group_number);
        if (roundGroups.length === 0) return null;
        const isActive = round.status === 'active';

        const courseData = round.course_data;
        const courseHoles: { number: number; par: number }[] = courseData?.holes
          ? courseData.holes.map((h: any) => ({ number: h.number, par: h.par }))
          : [];
        const totalCourseHoles = courseHoles.length;

        const game = games[round.id];
        const defaultPointsPerHole = game?.default_points_per_hole || 1;

        // Cross-group matches own the scoring for the round: their hole results
        // are stored against the match, not any single group.
        const matchesForRound = roundMatches
          .filter((m: any) => m.tournamentRoundId === round.id)
          .sort((a: any, b: any) => a.matchNumber - b.matchNumber);
        const roundGroupIds = new Set(roundGroups.map((g: any) => g.id));
        const roundScores = holeScores.filter((s: any) => roundGroupIds.has(s.tournament_group_id));
        const allSubmitted = roundGroups.every((g: any) => g.status === 'submitted');

        return (
          <Card key={round.id}>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {round.name || `Round ${round.round_number}`}
                </CardTitle>
                {isActive && (
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    LIVE
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-0">
              <div className="space-y-1.5">
                {matchesForRound.map((m: any) => {
                  const matchResults = holeResults.filter((r: any) => r.tournament_match_id === m.id);
                  const sideAIsTeamA = !m.teamAId || !teamMap[m.teamAId] ? true : true;
                  const teamA = teamMap[m.teamAId] || teamMap[teamIds[0]];
                  const teamB = teamMap[m.teamBId] || teamMap[teamIds[1]];
                  if (!teamA || !teamB) return null;
                  void sideAIsTeamA;

                  const totals = calcTeamTotals(matchResults, [teamA.id, teamB.id]);
                  const scoreA = totals[teamA.id] || 0;
                  const scoreB = totals[teamB.id] || 0;

                  const namesFor = (ids: string[]) =>
                    ids.map((id: string) => playerMap[id]?.display_name?.split(' ')[0] || '?').join(' / ');
                  const aNames = namesFor(m.sideA);
                  const bNames = namesFor(m.sideB);

                  const holesPlayed = matchResults.filter((r: any) => r.result_label && r.result_label !== '').length;
                  const totalPointsAvailable = totalCourseHoles * defaultPointsPerHole;
                  const remaining = Math.max(0, totalPointsAvailable - scoreA - scoreB);

                  let statusText = '';
                  if (allSubmitted || holesPlayed === totalCourseHoles) {
                    if (scoreA === scoreB) statusText = `Match Halved ${scoreA} — ${scoreB}`;
                    else {
                      const winner = scoreA > scoreB ? teamA.name : teamB.name;
                      statusText = `${winner} wins ${Math.max(scoreA, scoreB)} — ${Math.min(scoreA, scoreB)}`;
                    }
                  } else if (holesPlayed === 0) {
                    statusText = 'Not started';
                  } else if (scoreA === scoreB) {
                    statusText = `All Square · Thru ${holesPlayed} · ${remaining} pts left`;
                  } else {
                    const leader = scoreA > scoreB ? teamA.name : teamB.name;
                    statusText = `${leader} leads · Thru ${holesPlayed} · ${remaining} pts left`;
                  }

                  const holeResultsMap: Record<number, any> = {};
                  matchResults.forEach((r: any) => { holeResultsMap[r.hole_number] = r; });

                  const bestScore = (holeNum: number, ids: string[]): number | undefined => {
                    const vals = roundScores
                      .filter((s: any) => s.hole_number === holeNum && ids.includes(s.tournament_player_id) && s.gross_score != null)
                      .map((s: any) => s.gross_score as number);
                    return vals.length > 0 ? Math.min(...vals) : undefined;
                  };

                  const expandKey = `match-${m.id}`;
                  const isExpanded = expandedId === expandKey;

                  return (
                    <div key={m.id} className="rounded-lg bg-muted/50 overflow-hidden">
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setExpandedId(prev => prev === expandKey ? null : expandKey)}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        }
                        <span className="text-[10px] text-muted-foreground font-medium w-6 shrink-0">
                          M{m.matchNumber}
                        </span>

                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-xs font-medium truncate">{aNames}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamA.color }} />
                          <span className={`text-sm font-bold tabular-nums ${scoreA > scoreB ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {scoreA}
                          </span>
                          <span className="text-muted-foreground text-xs">-</span>
                          <span className={`text-sm font-bold tabular-nums ${scoreB > scoreA ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {scoreB}
                          </span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamB.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{bNames}</p>
                        </div>

                        {allSubmitted ? (
                          <span className="text-[10px] text-muted-foreground">F</span>
                        ) : isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        ) : null}
                      </div>

                      <div className="px-3 pb-2 -mt-1">
                        <p className={`text-[10px] text-center ${allSubmitted ? 'text-[hsl(var(--brand-gold))] font-semibold' : 'text-muted-foreground'}`}>
                          {statusText}
                        </p>
                      </div>

                      {isExpanded && courseHoles.length > 0 && (
                        <div className="border-t border-border">
                          <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
                            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamA.color }}>
                              {teamA.name}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamB.color }}>
                              {teamB.name}
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">
                              Result
                            </span>
                          </div>

                          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/50">
                            {courseHoles.map((hole, idx) => {
                              const r = holeResultsMap[hole.number];
                              const hasResult = r && r.result_label && r.result_label !== '';
                              const aScore = bestScore(hole.number, m.sideA);
                              const bScore = bestScore(hole.number, m.sideB);
                              const aPts = hasResult ? (r.team_points?.[teamA.id] || 0) : 0;
                              const bPts = hasResult ? (r.team_points?.[teamB.id] || 0) : 0;
                              const isAWin = aPts > bPts;
                              const isBWin = bPts > aPts;
                              const isHalved = aPts === bPts && aPts > 0;
                              const winnerColor = isAWin ? teamA.color : isBWin ? teamB.color : undefined;
                              const winPts = Math.max(aPts, bPts);

                              if (!hasResult) {
                                return (
                                  <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-30 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-[13px] font-bold font-mono">{hole.number}</span>
                                      <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                    </div>
                                    <span className="text-center text-muted-foreground text-sm">—</span>
                                    <span className="text-center text-muted-foreground text-sm">—</span>
                                    <span className="text-right text-muted-foreground text-xs">—</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                                    <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                  </div>
                                  <div className="flex justify-center">
                                    {aScore !== undefined ? (
                                      <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA.color} />
                                    ) : (
                                      <span className="text-muted-foreground/30 text-sm">—</span>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    {bScore !== undefined ? (
                                      <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB.color} />
                                    ) : (
                                      <span className="text-muted-foreground/30 text-sm">—</span>
                                    )}
                                  </div>
                                  <div className="flex justify-end">
                                    {isHalved ? (
                                      <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                                    ) : isAWin || isBWin ? (
                                      <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                        style={{ color: winnerColor, backgroundColor: winnerColor ? winnerColor + '18' : undefined }}
                                      >
                                        +{winPts}pt
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground/40">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap justify-center gap-2 px-3 py-2 border-t border-border">
                            {roundGroups.map((g: any) => (
                              <button
                                key={g.id}
                                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/tournament/${joinCode}/round/${round.id}/group/${g.id}`);
                                }}
                              >
                                Group {g.group_number} scorecard
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {matchesForRound.length === 0 && roundGroups.map((group: any) => {
                  const gPlayers = groupPlayers[group.id] || [];
                  const groupResults = holeResults.filter(r => r.tournament_group_id === group.id);
                  const groupScores = holeScores.filter((s: any) => s.tournament_group_id === group.id);

                  // Extract subMatchups
                  const tm = group.team_matchup as any;
                  const subMatchups: { playerA: string; playerB: string }[] | undefined =
                    tm?.subMatchups && Array.isArray(tm.subMatchups) ? tm.subMatchups : undefined;

                  // Player-to-team map
                  const gpTeamMap: Record<string, string> = {};
                  gPlayers.forEach((gp: any) => { gpTeamMap[gp.tournament_player_id] = gp.team_id; });

                  const teamPlayersMap: Record<string, any[]> = {};
                  gPlayers.forEach((gp: any) => {
                    if (!teamPlayersMap[gp.team_id]) teamPlayersMap[gp.team_id] = [];
                    const player = playerMap[gp.tournament_player_id];
                    if (player) teamPlayersMap[gp.team_id].push(player);
                  });

                  const isSubmitted = group.status === 'submitted';

                  // 1v1: render each sub-matchup as separate row
                  if (subMatchups && subMatchups.length > 0) {
                    const teamAId = tm?.teamAId;
                    const normalizeMatchup = (sm: { playerA: string; playerB: string }) =>
                      teamAId && gpTeamMap[sm.playerA] === teamAId ? sm : teamAId && gpTeamMap[sm.playerB] === teamAId ? { playerA: sm.playerB, playerB: sm.playerA } : sm;

                    return subMatchups.map((rawSm, smIdx) => {
                      const sm = normalizeMatchup(rawSm);
                      const pA = playerMap[sm.playerA];
                      const pB = playerMap[sm.playerB];
                      if (!pA || !pB) return null;

                      const aTeamId = gpTeamMap[sm.playerA];
                      const bTeamId = gpTeamMap[sm.playerB];
                      const teamA = teamMap[aTeamId];
                      const teamB = teamMap[bTeamId];
                      if (!teamA || !teamB) return null;

                      // Sum player_points for this sub-matchup
                      let aPts = 0, bPts = 0;
                      let holesPlayed = 0;
                      groupResults.forEach((r: any) => {
                        const ppA = r.player_points?.[sm.playerA];
                        const ppB = r.player_points?.[sm.playerB];
                        if (ppA !== undefined || ppB !== undefined) holesPlayed++;
                        aPts += ppA || 0;
                        bPts += ppB || 0;
                      });

                      const perMatchPoints = totalCourseHoles * defaultPointsPerHole / subMatchups.length;
                      const remaining = Math.max(0, perMatchPoints - aPts - bPts);
                      const aName = pA.display_name.split(' ')[0];
                      const bName = pB.display_name.split(' ')[0];

                      let statusText = '';
                      if (isSubmitted || holesPlayed === totalCourseHoles) {
                        if (aPts === bPts) statusText = `Halved ${aPts} — ${bPts}`;
                        else {
                          const winner = aPts > bPts ? aName : bName;
                          statusText = `${winner} wins ${Math.max(aPts, bPts)} — ${Math.min(aPts, bPts)}`;
                        }
                      } else if (holesPlayed === 0) {
                        statusText = 'Not started';
                      } else if (aPts === bPts) {
                        statusText = `All Square · Thru ${holesPlayed}`;
                      } else {
                        const leader = aPts > bPts ? aName : bName;
                        statusText = `${leader} ${Math.abs(aPts - bPts)} UP · Thru ${holesPlayed}`;
                      }

                      const expandKey = `${group.id}-${smIdx}`;
                      const isExpanded = expandedId === expandKey;

                      // Build hole results map
                      const holeResultsMap: Record<number, any> = {};
                      groupResults.forEach((r: any) => { holeResultsMap[r.hole_number] = r; });

                      return (
                        <div key={expandKey} className="rounded-lg bg-muted/50 overflow-hidden">
                          <div
                            className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => setExpandedId(prev => prev === expandKey ? null : expandKey)}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            }
                            <span className="text-[10px] text-muted-foreground font-medium w-6 shrink-0">
                              G{group.group_number}.{smIdx + 1}
                            </span>

                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-medium truncate">{aName}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamA.color }} />
                              <span className={`text-sm font-bold tabular-nums ${aPts > bPts ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {aPts}
                              </span>
                              <span className="text-muted-foreground text-xs">-</span>
                              <span className={`text-sm font-bold tabular-nums ${bPts > aPts ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {bPts}
                              </span>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamB.color }} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{bName}</p>
                            </div>

                            {isSubmitted ? (
                              <span className="text-[10px] text-muted-foreground">F</span>
                            ) : isActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                            ) : null}
                          </div>

                          <div className="px-3 pb-2 -mt-1">
                            <p className={`text-[10px] text-center ${isSubmitted ? 'text-[hsl(var(--brand-gold))] font-semibold' : 'text-muted-foreground'}`}>
                              {statusText}
                            </p>
                          </div>

                          {isExpanded && courseHoles.length > 0 && (
                            <div className="border-t border-border">
                              <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
                                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamA.color }}>
                                  {aName}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamB.color }}>
                                  {bName}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">
                                  Result
                                </span>
                              </div>

                              <div className="max-h-[300px] overflow-y-auto divide-y divide-border/50">
                                {courseHoles.map((hole, idx) => {
                                  const r = holeResultsMap[hole.number];
                                  const hasResult = r && r.result_label && r.result_label !== '';

                                  // Get per-player scores
                                  const aScore = groupScores.find((s: any) => s.hole_number === hole.number && s.tournament_player_id === sm.playerA)?.gross_score;
                                  const bScore = groupScores.find((s: any) => s.hole_number === hole.number && s.tournament_player_id === sm.playerB)?.gross_score;

                                  const ppA = hasResult ? (r.player_points?.[sm.playerA] || 0) : 0;
                                  const ppB = hasResult ? (r.player_points?.[sm.playerB] || 0) : 0;
                                  const isAWin = ppA > ppB;
                                  const isBWin = ppB > ppA;
                                  const isHalved = ppA === ppB && ppA > 0;
                                  const winnerColor = isAWin ? teamA.color : isBWin ? teamB.color : undefined;
                                  const winPts = Math.max(ppA, ppB);

                                  if (!hasResult) {
                                    return (
                                      <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-30 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                        <div className="flex items-baseline gap-1">
                                          <span className="text-[13px] font-bold font-mono">{hole.number}</span>
                                          <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                        </div>
                                        <span className="text-center text-muted-foreground text-sm">—</span>
                                        <span className="text-center text-muted-foreground text-sm">—</span>
                                        <span className="text-right text-muted-foreground text-xs">—</span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                                        <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                      </div>
                                      <div className="flex justify-center">
                                        {aScore != null ? (
                                          <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA.color} />
                                        ) : (
                                          <span className="text-muted-foreground/30 text-sm">—</span>
                                        )}
                                      </div>
                                      <div className="flex justify-center">
                                        {bScore != null ? (
                                          <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB.color} />
                                        ) : (
                                          <span className="text-muted-foreground/30 text-sm">—</span>
                                        )}
                                      </div>
                                      <div className="flex justify-end">
                                        {isHalved ? (
                                          <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                                        ) : isAWin || isBWin ? (
                                          <span
                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                            style={{ color: winnerColor, backgroundColor: winnerColor ? winnerColor + '18' : undefined }}
                                          >
                                            +{winPts}pt
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground/40">—</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div
                                className="flex items-center justify-center gap-1 px-3 py-2 border-t border-border text-xs text-primary font-medium cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/tournament/${joinCode}/round/${round.id}/group/${group.id}`);
                                }}
                              >
                                View Full Scorecard
                                <ExternalLink className="w-3 h-3" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  }

                  // Default combined team view
                  const totals = calcTeamTotals(groupResults, teamIds);
                  const matchTeamIds = Object.keys(teamPlayersMap);
                  if (matchTeamIds.length < 2) return null;

                  const teamA = teamMap[matchTeamIds[0]];
                  const teamB = teamMap[matchTeamIds[1]];
                  if (!teamA || !teamB) return null;

                  const scoreA = totals[teamA.id] || 0;
                  const scoreB = totals[teamB.id] || 0;
                  const playersA = teamPlayersMap[teamA.id] || [];
                  const playersB = teamPlayersMap[teamB.id] || [];
                  const isExpanded = expandedId === group.id;

                  const holesPlayed = groupResults.filter((r: any) => r.result_label && r.result_label !== '').length;
                  const totalPointsAvailable = totalCourseHoles * defaultPointsPerHole;
                  const pointsUsed = scoreA + scoreB;
                  const remaining = Math.max(0, totalPointsAvailable - pointsUsed);

                  let statusText = '';
                  if (isSubmitted || holesPlayed === totalCourseHoles) {
                    if (scoreA === scoreB) statusText = `Match Halved ${scoreA} — ${scoreB}`;
                    else {
                      const winner = scoreA > scoreB ? teamA.name : teamB.name;
                      statusText = `${winner} wins ${Math.max(scoreA, scoreB)} — ${Math.min(scoreA, scoreB)}`;
                    }
                  } else if (holesPlayed === 0) {
                    statusText = 'Not started';
                  } else if (scoreA === scoreB) {
                    statusText = `All Square · Thru ${holesPlayed} · ${remaining} pts left`;
                  } else {
                    const leader = scoreA > scoreB ? teamA.name : teamB.name;
                    statusText = `${leader} leads · Thru ${holesPlayed} · ${remaining} pts left`;
                  }

                  const holeResultsMap: Record<number, any> = {};
                  groupResults.forEach((r: any) => { holeResultsMap[r.hole_number] = r; });

                  const playerTeamMap: Record<string, string> = {};
                  gPlayers.forEach((gp: any) => { playerTeamMap[gp.tournament_player_id] = gp.team_id; });

                  const getTeamBestScore = (holeNum: number, teamId: string): number | undefined => {
                    const scores = groupScores
                      .filter((s: any) => s.hole_number === holeNum && playerTeamMap[s.tournament_player_id] === teamId && s.gross_score != null)
                      .map((s: any) => s.gross_score as number);
                    return scores.length > 0 ? Math.min(...scores) : undefined;
                  };

                  return (
                    <div key={group.id} className="rounded-lg bg-muted/50 overflow-hidden">
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setExpandedId(prev => prev === group.id ? null : group.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        }
                        <span className="text-[10px] text-muted-foreground font-medium w-4 shrink-0">
                          G{group.group_number}
                        </span>

                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-xs font-medium truncate">
                            {playersA.map(p => p.display_name.split(' ')[0]).join(' / ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamA.color }} />
                          <span className={`text-sm font-bold tabular-nums ${scoreA > scoreB ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {scoreA}
                          </span>
                          <span className="text-muted-foreground text-xs">-</span>
                          <span className={`text-sm font-bold tabular-nums ${scoreB > scoreA ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {scoreB}
                          </span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamB.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {playersB.map(p => p.display_name.split(' ')[0]).join(' / ')}
                          </p>
                        </div>

                        {isSubmitted ? (
                          <span className="text-[10px] text-muted-foreground">F</span>
                        ) : isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        ) : null}
                      </div>

                      <div className="px-3 pb-2 -mt-1">
                        <p className={`text-[10px] text-center ${isSubmitted ? 'text-[hsl(var(--brand-gold))] font-semibold' : 'text-muted-foreground'}`}>
                          {statusText}
                        </p>
                      </div>

                      {isExpanded && courseHoles.length > 0 && (
                        <div className="border-t border-border">
                          <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
                            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamA.color }}>
                              {teamA.name}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamB.color }}>
                              {teamB.name}
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">
                              Result
                            </span>
                          </div>

                          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/50">
                            {courseHoles.map((hole, idx) => {
                              const r = holeResultsMap[hole.number];
                              const hasResult = r && r.result_label && r.result_label !== '';

                              const aScore = getTeamBestScore(hole.number, teamA.id);
                              const bScore = getTeamBestScore(hole.number, teamB.id);

                              const aPts = hasResult ? (r.team_points?.[teamA.id] || 0) : 0;
                              const bPts = hasResult ? (r.team_points?.[teamB.id] || 0) : 0;
                              const isAWin = aPts > bPts;
                              const isBWin = bPts > aPts;
                              const isHalved = aPts === bPts && aPts > 0;
                              const winnerColor = isAWin ? teamA.color : isBWin ? teamB.color : undefined;
                              const winPts = Math.max(aPts, bPts);

                              if (!hasResult) {
                                return (
                                  <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-30 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-[13px] font-bold font-mono">{hole.number}</span>
                                      <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                    </div>
                                    <span className="text-center text-muted-foreground text-sm">—</span>
                                    <span className="text-center text-muted-foreground text-sm">—</span>
                                    <span className="text-right text-muted-foreground text-xs">—</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={hole.number} className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                                    <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                                  </div>
                                  <div className="flex justify-center">
                                    {aScore !== undefined ? (
                                      <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA.color} />
                                    ) : (
                                      <span className="text-muted-foreground/30 text-sm">—</span>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    {bScore !== undefined ? (
                                      <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB.color} />
                                    ) : (
                                      <span className="text-muted-foreground/30 text-sm">—</span>
                                    )}
                                  </div>
                                  <div className="flex justify-end">
                                    {isHalved ? (
                                      <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                                    ) : isAWin || isBWin ? (
                                      <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                        style={{ color: winnerColor, backgroundColor: winnerColor ? winnerColor + '18' : undefined }}
                                      >
                                        +{winPts}pt
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground/40">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div
                            className="flex items-center justify-center gap-1 px-3 py-2 border-t border-border text-xs text-primary font-medium cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/tournament/${joinCode}/round/${round.id}/group/${group.id}`);
                            }}
                          >
                            View Full Scorecard
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

/* ── ScoreChip ── */
const ScoreChip: React.FC<{
  score: number;
  par: number;
  isWinner: boolean;
  winColor?: string;
}> = ({ score, par, isWinner, winColor }) => {
  const diff = score - par;
  let color = 'hsl(var(--muted-foreground))';
  let bg = 'transparent';
  let isCircle = false;

  if (diff <= -2) { color = '#FFD700'; bg = '#FFD70018'; isCircle = true; }
  else if (diff === -1) { color = '#FF6B6B'; bg = '#FF6B6B18'; }
  else if (diff === 0) { color = 'hsl(var(--foreground))'; }
  else if (diff === 1) { color = '#3A86FF'; }
  else { color = 'hsl(var(--muted-foreground) / 0.4)'; }

  if (isWinner && winColor) { color = winColor; bg = winColor + '20'; }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: isCircle ? '50%' : 6,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'monospace',
        border: isCircle ? `1px solid ${color}50` : undefined,
        flexShrink: 0,
      }}
    >
      {score}
    </span>
  );
};

export default GroupMatchesScoreboard;
