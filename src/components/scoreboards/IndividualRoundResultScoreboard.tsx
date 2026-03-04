import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  teams: any[];
  rounds: any[];
  players: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  holeResults: any[];
}

const IndividualRoundResultScoreboard: React.FC<Props> = ({
  teams, rounds, players, groups, groupPlayers, holeResults,
}) => {
  const startedRounds = rounds.filter((r: any) => r.status !== 'pending');

  if (startedRounds.length === 0) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Waiting for Round 1 to begin</CardContent></Card>;
  }

  // For each player, determine W/L/H per round
  const playerResults = players.map((p: any) => {
    const team = teams.find((t: any) => t.id === p.team_id);
    let wins = 0, halves = 0, losses = 0;

    const roundResults = startedRounds.map((r: any) => {
      const allGroups = Object.values(groups).flat() as any[];
      const roundGroups = allGroups.filter((g: any) => g.tournament_round_id === r.id);
      const group = roundGroups.find((g: any) =>
        (groupPlayers[g.id] || []).some((gp: any) => gp.tournament_player_id === p.id)
      );
      if (!group) return { result: null, label: '—' };

      const isActive = r.status === 'active' && group.status !== 'submitted';
      if (isActive) return { result: 'live', label: '🟢' };

      const results = holeResults.filter((hr: any) => hr.tournament_group_id === group.id);
      if (results.length === 0) return { result: null, label: '—' };

      // Determine player's team totals
      const playerTeamId = p.team_id;
      let myPts = 0, oppPts = 0;
      results.forEach((hr: any) => {
        const tp = hr.team_points as Record<string, number>;
        if (tp) {
          Object.entries(tp).forEach(([tid, pts]) => {
            if (tid === playerTeamId) myPts += Number(pts);
            else oppPts += Number(pts);
          });
        }
      });

      if (myPts > oppPts) {
        wins++;
        return { result: 'W', label: `W` };
      } else if (oppPts > myPts) {
        losses++;
        return { result: 'L', label: `L` };
      } else {
        halves++;
        return { result: 'H', label: 'H' };
      }
    });

    return { player: p, team, roundResults, wins, halves, losses };
  });

  // Sort by wins desc, halves desc
  playerResults.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.halves - a.halves;
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider">Player</TableHead>
              {startedRounds.map((r: any) => (
                <TableHead key={r.id} className="w-14 text-center text-xs uppercase tracking-wider">R{r.round_number}</TableHead>
              ))}
              <TableHead className="w-20 text-center text-xs uppercase tracking-wider font-bold">W-H-L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playerResults.map(d => (
              <TableRow key={d.player.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {d.team && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.team.color }} />}
                    <span className="font-medium text-sm">{d.player.display_name}</span>
                  </div>
                </TableCell>
                {d.roundResults.map((rr, i) => (
                  <TableCell key={i} className="text-center">
                    {rr.result === 'W' ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-success/20 text-success border border-success/30 font-medium">W</span>
                    ) : rr.result === 'L' ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 font-medium">L</span>
                    ) : rr.result === 'H' ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">H</span>
                    ) : rr.result === 'live' ? (
                      <span className="text-xs">🟢</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-center font-mono text-sm font-bold">
                  {d.wins}-{d.halves}-{d.losses}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default IndividualRoundResultScoreboard;
