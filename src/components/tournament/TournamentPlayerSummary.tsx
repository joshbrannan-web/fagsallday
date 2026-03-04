import React from 'react';
import type { TournamentPlayer } from '@/types/tournament';

interface Props {
  players: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  allHoleScores: Record<string, Record<number, number>>;
  holeResults: Record<number, { netScores?: Record<string, number>; playerPoints?: Record<string, number> }>;
  holesPlayed: number;
}

const TournamentPlayerSummary: React.FC<Props> = ({
  players, teamAssignments, teams, allHoleScores, holeResults, holesPlayed,
}) => {
  // Compute per-player totals
  const playerData = players.map(p => {
    const teamId = teamAssignments[p.id];
    const team = teams[teamId];

    let grossTotal = 0;
    let netTotal = 0;
    let ptsTotal = 0;

    Object.entries(allHoleScores[p.id] || {}).forEach(([h, score]) => {
      grossTotal += score;
      const nr = holeResults[Number(h)]?.netScores?.[p.id];
      netTotal += nr ?? score;
    });

    // Sum player points from all hole results
    Object.values(holeResults).forEach(hr => {
      const pp = hr.playerPoints?.[p.id];
      if (pp !== undefined) ptsTotal = pp; // playerPoints is cumulative in engine
    });

    return { player: p, teamId, team, grossTotal, netTotal, ptsTotal };
  });

  // Sort by team then gross ascending
  playerData.sort((a, b) => {
    if (a.teamId !== b.teamId) return a.teamId.localeCompare(b.teamId);
    return a.grossTotal - b.grossTotal;
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Player</th>
            <th className="text-center px-2 py-2 font-medium">Team</th>
            <th className="text-center px-2 py-2 font-medium">Gross</th>
            <th className="text-center px-2 py-2 font-medium">Net</th>
            <th className="text-center px-2 py-2 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {playerData.map(({ player, team, grossTotal, netTotal, ptsTotal }) => (
            <tr key={player.id}>
              <td className="px-3 py-2 font-medium text-foreground truncate max-w-[120px]">
                {player.displayName}
              </td>
              <td className="text-center px-2 py-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team?.color }} />
              </td>
              <td className="text-center px-2 py-2 font-mono text-foreground">{grossTotal || '—'}</td>
              <td className="text-center px-2 py-2 font-mono text-muted-foreground">{netTotal || '—'}</td>
              <td className="text-center px-2 py-2 font-mono font-semibold text-foreground">{ptsTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TournamentPlayerSummary;
