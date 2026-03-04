import React from 'react';
import { Trophy } from 'lucide-react';
import type { MatchState } from '@/types/tournament';

interface Props {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
  matchState?: MatchState;
  totalPointsAvailable: number;
}

const TournamentMatchStatusBar: React.FC<Props> = ({
  tournamentName, roundName, teamMatchup, teams, teamTotals,
  holesPlayed, matchState, totalPointsAvailable,
}) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;
  const pointsUsed = totalA + totalB;
  const remaining = Math.max(0, totalPointsAvailable - pointsUsed);

  let statusLine = '';
  if (matchState?.isComplete) {
    if (totalA === totalB) {
      statusLine = `Match Halved ${totalA} — ${totalB}`;
    } else {
      const winner = totalA > totalB ? teamA?.name : teamB?.name;
      statusLine = `${winner} wins ${Math.max(totalA, totalB)} — ${Math.min(totalA, totalB)}`;
    }
  } else if (matchState?.isDormie) {
    const leader = matchState.leadingTeamId ? teams[matchState.leadingTeamId]?.name : '';
    statusLine = `${leader} leads • Dormie • ${remaining} pts left`;
  } else if (totalA === totalB) {
    statusLine = `All Square • Thru ${holesPlayed} • ${remaining} pts left`;
  } else {
    const leader = totalA > totalB ? teamA?.name : teamB?.name;
    statusLine = `${leader} leads • Thru ${holesPlayed} • ${remaining} pts left`;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--brand-gold))' }} />
        <span>{tournamentName}{roundName ? ` — ${roundName}` : ''}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA?.color }} />
          <span className={`font-semibold text-sm ${totalA >= totalB ? 'text-foreground' : 'text-muted-foreground'}`}>
            {teamA?.name || 'Team A'}
          </span>
        </div>
        <div className="text-3xl font-bold text-foreground font-mono">
          {totalA} <span className="text-muted-foreground text-lg">—</span> {totalB}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${totalB >= totalA ? 'text-foreground' : 'text-muted-foreground'}`}>
            {teamB?.name || 'Team B'}
          </span>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB?.color }} />
        </div>
      </div>

      <p className={`text-xs text-center ${matchState?.isComplete ? 'text-[hsl(var(--brand-gold))] font-bold' : 'text-muted-foreground'}`}>
        {statusLine}
      </p>
    </div>
  );
};

export default TournamentMatchStatusBar;
