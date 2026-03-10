import React from 'react';
import RyderCupGraphic from './RyderCupGraphic';
import TeamPointsBreakdownTable from './TeamPointsBreakdownTable';

interface Props {
  teams: any[];
  rounds: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  players: any[];
  holeResults: any[];
  tournamentStatus: string;
  games: Record<string, any>;
  joinCode: string;
  teamScoringMethod?: 'cumulative' | 'round_win';
}

const TeamPointsScoreboard: React.FC<Props> = (props) => {
  return (
    <div className="space-y-4">
      <RyderCupGraphic
        teams={props.teams}
        rounds={props.rounds}
        groups={props.groups}
        holeResults={props.holeResults}
        tournamentStatus={props.tournamentStatus}
        games={props.games}
      />
      <TeamPointsBreakdownTable
        teams={props.teams}
        rounds={props.rounds}
        groups={props.groups}
        groupPlayers={props.groupPlayers}
        players={props.players}
        holeResults={props.holeResults}
        joinCode={props.joinCode}
      />
    </div>
  );
};

export default TeamPointsScoreboard;
