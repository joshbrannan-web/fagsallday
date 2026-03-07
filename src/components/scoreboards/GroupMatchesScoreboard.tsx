import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  tournamentStatus: string;
  joinCode: string;
}

const GroupMatchesScoreboard: React.FC<Props> = ({
  teams, rounds, groups, groupPlayers, holeResults, players, joinCode,
}) => {
  const navigate = useNavigate();
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
              <div className="space-y-1">
                {roundGroups.map((group: any) => {
                  const gPlayers = groupPlayers[group.id] || [];
                  const groupResults = holeResults.filter(r => r.tournament_group_id === group.id);
                  const totals = calcTeamTotals(groupResults, teamIds);

                  // Group players by team
                  const teamPlayersMap: Record<string, any[]> = {};
                  gPlayers.forEach((gp: any) => {
                    if (!teamPlayersMap[gp.team_id]) teamPlayersMap[gp.team_id] = [];
                    const player = playerMap[gp.tournament_player_id];
                    if (player) teamPlayersMap[gp.team_id].push(player);
                  });

                  const matchTeamIds = Object.keys(teamPlayersMap);
                  if (matchTeamIds.length < 2) return null;

                  const teamA = teamMap[matchTeamIds[0]];
                  const teamB = teamMap[matchTeamIds[1]];
                  if (!teamA || !teamB) return null;

                  const scoreA = totals[teamA.id] || 0;
                  const scoreB = totals[teamB.id] || 0;
                  const playersA = teamPlayersMap[teamA.id] || [];
                  const playersB = teamPlayersMap[teamB.id] || [];
                  const isSubmitted = group.status === 'submitted';

                  return (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/tournament/${joinCode}/round/${round.id}/group/${group.id}`)}
                    >
                      <span className="text-[10px] text-muted-foreground font-medium w-4 shrink-0">
                        G{group.group_number}
                      </span>

                      {/* Team A */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-medium truncate">
                          {playersA.map(p => p.display_name.split(' ')[0]).join(' / ')}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: teamA.color }}
                        />
                        <span className={`text-sm font-bold tabular-nums ${scoreA > scoreB ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {scoreA}
                        </span>
                        <span className="text-muted-foreground text-xs">-</span>
                        <span className={`text-sm font-bold tabular-nums ${scoreB > scoreA ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {scoreB}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: teamB.color }}
                        />
                      </div>

                      {/* Team B */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {playersB.map(p => p.display_name.split(' ')[0]).join(' / ')}
                        </p>
                      </div>

                      {/* Status indicator */}
                      {isSubmitted ? (
                        <span className="text-[10px] text-muted-foreground">F</span>
                      ) : isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                      ) : null}
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

export default GroupMatchesScoreboard;
