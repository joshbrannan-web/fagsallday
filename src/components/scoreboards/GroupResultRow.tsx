import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { calcTeamTotals } from '@/services/scoreboardCalculations';

interface Props {
  group: any;
  teamA: any;
  teamB: any;
  groupPlayers: any[];
  players: any[];
  holeResults: any[];
  joinCode: string;
  roundId: string;
}

const GroupResultRow: React.FC<Props> = ({
  group, teamA, teamB, groupPlayers, players, holeResults, joinCode, roundId,
}) => {
  const navigate = useNavigate();
  const totals = calcTeamTotals(holeResults, [teamA.id, teamB.id]);
  const a = totals[teamA.id] || 0;
  const b = totals[teamB.id] || 0;

  const getNames = (teamId: string) =>
    groupPlayers
      .filter((gp: any) => gp.team_id === teamId)
      .map((gp: any) => {
        const p = players.find((p: any) => p.id === gp.tournament_player_id);
        return p ? p.display_name.split(' ')[0] : '?';
      })
      .join(', ');

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/30 bg-muted/10"
      onClick={() => navigate(`/tournament/${joinCode}/round/${roundId}/group/${group.id}`)}
    >
      <TableCell className="pl-8 text-xs text-muted-foreground">
        <span>Grp {group.group_number}: </span>
        <span>{getNames(teamA.id)} vs {getNames(teamB.id)}</span>
      </TableCell>
      <TableCell className="text-center font-mono text-xs">{a}</TableCell>
      <TableCell className="text-center font-mono text-xs">{b}</TableCell>
      <TableCell className="text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          a > b ? 'bg-success/20 text-success' :
          b > a ? 'bg-destructive/20 text-destructive' :
          'bg-muted text-muted-foreground'
        }`}>
          {a > b ? `${teamA.name}` : b > a ? `${teamB.name}` : '½'}
        </span>
      </TableCell>
    </TableRow>
  );
};

export default GroupResultRow;
