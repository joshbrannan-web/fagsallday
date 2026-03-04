import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import GroupResultRow from './GroupResultRow';
import { calcTeamTotals } from '@/services/scoreboardCalculations';

interface Props {
  teams: any[];
  rounds: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  players: any[];
  holeResults: any[];
  joinCode: string;
}

const TeamRoundResultScoreboard: React.FC<Props> = ({
  teams, rounds, groups, groupPlayers, players, holeResults, joinCode,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (teams.length < 2) return null;
  const teamA = teams[0];
  const teamB = teams[1];
  const teamIds = [teamA.id, teamB.id];
  const startedRounds = rounds.filter((r: any) => r.status !== 'pending');

  let grandA = 0, grandB = 0;

  const roundData = startedRounds.map((r: any) => {
    const roundGroups = groups[r.id] || [];
    const roundGroupIds = new Set(roundGroups.map((g: any) => g.id));
    const roundResults = holeResults.filter((hr: any) => roundGroupIds.has(hr.tournament_group_id));
    const totals = calcTeamTotals(roundResults, teamIds);
    const a = totals[teamA.id] || 0;
    const b = totals[teamB.id] || 0;
    grandA += a;
    grandB += b;
    return { round: r, roundGroups, a, b, isActive: r.status === 'active' };
  });

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider">Round</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider" style={{ color: teamA.color }}>{teamA.name}</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider" style={{ color: teamB.color }}>{teamB.name}</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roundData.map(({ round, roundGroups, a, b, isActive }) => (
              <React.Fragment key={round.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggle(round.id)}
                >
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1">
                      {expanded.has(round.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {round.name || `Round ${round.round_number}`}
                    </div>
                  </TableCell>
                  <TableCell className={`text-center font-mono text-sm ${isActive ? 'italic' : ''}`}>{a}</TableCell>
                  <TableCell className={`text-center font-mono text-sm ${isActive ? 'italic' : ''}`}>{b}</TableCell>
                  <TableCell className="text-center text-sm">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
                      </span>
                    ) : a > b ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA.color }} />
                        <span className="text-xs font-medium">{teamA.name}</span>
                      </span>
                    ) : b > a ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB.color }} />
                        <span className="text-xs font-medium">{teamB.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">½ Halved</span>
                    )}
                  </TableCell>
                </TableRow>
                {expanded.has(round.id) && roundGroups.map((g: any) => (
                  <GroupResultRow
                    key={g.id}
                    group={g}
                    teamA={teamA}
                    teamB={teamB}
                    groupPlayers={groupPlayers[g.id] || []}
                    players={players}
                    holeResults={holeResults.filter((hr: any) => hr.tournament_group_id === g.id)}
                    joinCode={joinCode}
                    roundId={round.id}
                  />
                ))}
              </React.Fragment>
            ))}
            {/* Grand total */}
            <TableRow className="border-t-2 font-bold">
              <TableCell className="text-sm">Total</TableCell>
              <TableCell className="text-center font-mono text-sm">{grandA}</TableCell>
              <TableCell className="text-center font-mono text-sm">{grandB}</TableCell>
              <TableCell className="text-center text-sm">
                {grandA > grandB ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA.color }} />
                    {teamA.name} leads
                  </span>
                ) : grandB > grandA ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB.color }} />
                    {teamB.name} leads
                  </span>
                ) : (
                  <span className="text-muted-foreground">Tied</span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default TeamRoundResultScoreboard;
