import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, CheckCircle } from 'lucide-react';
import { calcTeamTotals, calcTeamTotalsPerRound, calcPointsToWin, calcRoundTeamAward } from '@/services/scoreboardCalculations';

interface Props {
  teams: any[];
  rounds: any[];
  groups: Record<string, any[]>;
  holeResults: any[];
  tournamentStatus: string;
  games: Record<string, any>;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
}

const RyderCupGraphic: React.FC<Props> = ({ teams, rounds, groups, holeResults, tournamentStatus, games, teamScoringMethod, customRoundPoints }) => {
  if (teams.length < 2) return null;

  const teamA = teams[0];
  const teamB = teams[1];
  const teamIds = [teamA.id, teamB.id];

  const perRound = calcTeamTotalsPerRound(rounds, groups, holeResults, teamIds);

  // Grand total
  const completedRounds = rounds.filter((r: any) => r.status === 'completed');
  const totals: Record<string, number> = {};
  teamIds.forEach(id => { totals[id] = 0; });

  const roundHoleResults = (round: any) => {
    const ids = new Set((groups[round.id] || []).map((g: any) => g.id));
    return holeResults.filter((r: any) => ids.has(r.tournament_group_id));
  };

  const awardForRound = (round: any, completed: boolean) =>
    calcRoundTeamAward(
      round,
      perRound[round.id] || {},
      roundHoleResults(round) as any,
      [teamA.id, teamB.id],
      teamScoringMethod,
      customRoundPoints,
      completed
    );

  completedRounds.forEach((r: any) => {
    const award = awardForRound(r, true);
    teamIds.forEach(id => { totals[id] += award[id] || 0; });
  });

  const totalA = totals[teamA.id] || 0;
  const totalB = totals[teamB.id] || 0;
  const grandTotal = totalA + totalB;

  const startedRounds = rounds.filter((r: any) => r.status === 'active' || r.status === 'completed');
  const isComplete = tournamentStatus === 'completed';

  // Points to win: use first game's default_points_per_hole
  const firstGame = Object.values(games)[0] as any;
  const pointsToWin = calcPointsToWin(rounds, groups, firstGame?.default_points_per_hole || 1);

  const leadingTeam = totalA > totalB ? teamA : totalB > totalA ? teamB : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {/* Team names */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: teamA.color }} />
            <span className="text-lg font-bold tracking-widest uppercase" style={{ color: teamA.color }}>
              {teamA.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-widest uppercase" style={{ color: teamB.color }}>
              {teamB.name}
            </span>
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: teamB.color }} />
          </div>
        </div>

        {/* Large totals */}
        <div className="flex justify-between items-center">
          <span
            className={`text-5xl font-bold tabular-nums ${leadingTeam?.id === teamA.id ? 'text-[hsl(var(--brand-gold))]' : 'text-foreground'}`}
          >
            {totalA % 1 === 0 ? totalA : totalA.toFixed(1)}
          </span>
          <span className="text-2xl text-muted-foreground font-light">—</span>
          <span
            className={`text-5xl font-bold tabular-nums ${leadingTeam?.id === teamB.id ? 'text-[hsl(var(--brand-gold))]' : 'text-foreground'}`}
          >
            {totalB % 1 === 0 ? totalB : totalB.toFixed(1)}
          </span>
        </div>

        {/* Winner banner */}
        {isComplete && leadingTeam && (
          <div className="bg-[hsl(var(--brand-gold))]/20 border border-[hsl(var(--brand-gold))]/40 rounded-lg p-3 text-center">
            <span className="text-lg font-bold">🏆 {leadingTeam.name.toUpperCase()} WINS {totalA > totalB ? `${totalA} — ${totalB}` : `${totalB} — ${totalA}`}</span>
          </div>
        )}

        {/* Progress bar */}
        {grandTotal > 0 && (
          <div className="space-y-1">
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full rounded-l-full transition-all duration-500"
                style={{ width: `${(totalA / grandTotal) * 100}%`, backgroundColor: teamA.color }}
              />
              <div
                className="h-full rounded-r-full transition-all duration-500"
                style={{ width: `${(totalB / grandTotal) * 100}%`, backgroundColor: teamB.color }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">Points to win: {pointsToWin}</p>
          </div>
        )}

        {startedRounds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Tournament has not started yet</p>
        )}

        {/* Per-round breakdown */}
        {startedRounds.length > 0 && (
          <div className="space-y-2">
            {startedRounds.map((round: any) => {
              const isActive = round.status === 'active';
              const isCompleted = round.status === 'completed';

              const award = awardForRound(round, isCompleted);
              const displayA = award[teamA.id] || 0;
              const displayB = award[teamB.id] || 0;

              return (
                <div key={round.id} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">{round.name || `Round ${round.round_number}`}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono" style={{ color: teamA.color }}>{displayA % 1 === 0 ? displayA : displayA.toFixed(1)}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="font-mono" style={{ color: teamB.color }}>{displayB % 1 === 0 ? displayB : displayB.toFixed(1)}</span>
                    {isCompleted && <CheckCircle className="w-4 h-4 text-success" />}
                    {isActive && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RyderCupGraphic;
