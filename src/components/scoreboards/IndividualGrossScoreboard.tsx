import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calcPlayerGrossPerRound, calcThru, rankWithTies, playerHasOverride } from '@/services/scoreboardCalculations';

interface Props {
  teams: any[];
  rounds: any[];
  players: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  holeScores: any[];
  scoreType?: string;
}

const IndividualGrossScoreboard: React.FC<Props> = ({
  teams, rounds, players, groups, groupPlayers, holeScores,
}) => {
  const allGroups = Object.values(groups).flat();
  const startedRounds = rounds.filter((r: any) => r.status !== 'pending');
  const activeRound = rounds.find((r: any) => r.status === 'active');
  const activeGroups = activeRound ? (groups[activeRound.id] || []) : [];

  // Compute per-player data
  const playerData = players.map((p: any) => {
    const roundScores = startedRounds.map((r: any) =>
      calcPlayerGrossPerRound(p.id, r.id, allGroups, groupPlayers, holeScores)
    );
    const total = roundScores.reduce((s: number, v) => s + (v ?? 0), 0);
    const hasAny = roundScores.some(v => v !== null);
    const thru = activeRound ? calcThru(p.id, activeGroups, groupPlayers, holeScores) : null;
    const hasOverride = playerHasOverride(p.id, holeScores);
    const team = teams.find((t: any) => t.id === p.team_id);

    return { player: p, roundScores, total: hasAny ? total : null, thru, hasOverride, team };
  });

  const ranked = rankWithTies(
    playerData.map(d => ({ id: d.player.id, value: d.total })),
    'asc'
  );

  const rankedData = ranked.map(r => ({
    ...r,
    ...playerData.find(d => d.player.id === r.id)!,
  }));

  const hasOverrides = rankedData.some(d => d.hasOverride);

  if (startedRounds.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Waiting for Round 1 to begin
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center text-xs uppercase tracking-wider">Pos</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Player</TableHead>
              <TableHead className="w-10 text-center text-xs uppercase tracking-wider">HCP</TableHead>
              {startedRounds.map((r: any) => (
                <TableHead key={r.id} className="w-12 text-center font-mono text-xs uppercase tracking-wider">
                  R{r.round_number}
                </TableHead>
              ))}
              <TableHead className="w-14 text-center text-xs uppercase tracking-wider font-bold">Total</TableHead>
              {activeRound && (
                <TableHead className="w-12 text-center text-xs uppercase tracking-wider">Thru</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedData.map((d, idx) => (
              <TableRow
                key={d.player.id}
                className={
                  d.rank === 1 ? 'border-l-2 border-l-yellow-500' :
                  d.rank === 2 ? 'border-l-2 border-l-gray-400' :
                  d.rank === 3 ? 'border-l-2 border-l-amber-700' : ''
                }
              >
                <TableCell className="text-center font-bold text-sm">
                  {d.total !== null ? (d.isTied ? `T${d.rank}` : d.rank) : ''}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {d.team && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.team.color }} />
                    )}
                    <span className="font-medium text-sm">{d.player.display_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {d.player.handicap_override ?? d.player.handicap_index}
                  {d.player.handicap_override != null && <span className="text-amber-400">*</span>}
                </TableCell>
                {d.roundScores.map((score: number | null, i: number) => {
                  const isActive = startedRounds[i]?.status === 'active';
                  return (
                    <TableCell
                      key={i}
                      className={`text-center font-mono text-sm ${isActive ? 'italic text-muted-foreground' : ''}`}
                    >
                      {score !== null ? score : '—'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold font-mono text-sm">
                  {d.total !== null ? d.total : '—'}
                  {d.hasOverride && <span className="text-amber-400 text-xs">*</span>}
                </TableCell>
                {activeRound && (
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {d.thru === 'F' ? 'F' : d.thru !== null ? d.thru : '—'}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasOverrides && (
        <p className="px-4 py-2 text-xs text-muted-foreground border-t">
          * Contains score adjusted by tournament admin
        </p>
      )}
    </Card>
  );
};

export default IndividualGrossScoreboard;
