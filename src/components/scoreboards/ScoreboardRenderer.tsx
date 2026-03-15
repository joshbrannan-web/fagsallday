import React from 'react';
import TeamPointsScoreboard from './TeamPointsScoreboard';
import IndividualGrossScoreboard from './IndividualGrossScoreboard';
import IndividualNetScoreboard from './IndividualNetScoreboard';
import IndividualPointsScoreboard from './IndividualPointsScoreboard';
import TeamRoundResultScoreboard from './TeamRoundResultScoreboard';
import IndividualRoundResultScoreboard from './IndividualRoundResultScoreboard';
import GroupMatchesScoreboard from './GroupMatchesScoreboard';
import { Card, CardContent } from '@/components/ui/card';

interface ScoreboardData {
  teams: any[];
  rounds: any[];
  players: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  holeResults: any[];
  holeScores: any[];
  games: Record<string, any>;
  tournamentStatus: string;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
}

interface Props {
  scoreboard: { scoreboard_type: string; name: string; id: string };
  data: ScoreboardData;
  joinCode: string;
}

const ScoreboardRenderer: React.FC<Props> = ({ scoreboard, data, joinCode }) => {
  const commonProps = { ...data, joinCode };

  switch (scoreboard.scoreboard_type) {
    case 'team_points':
      return <TeamPointsScoreboard {...commonProps} />;
    case 'individual_gross':
      return <IndividualGrossScoreboard {...commonProps} scoreType="gross" />;
    case 'individual_net':
      return <IndividualNetScoreboard {...commonProps} />;
    case 'individual_points':
      return <IndividualPointsScoreboard {...commonProps} />;
    case 'team_round_result':
      return <TeamRoundResultScoreboard {...commonProps} />;
    case 'individual_round_result':
      return <IndividualRoundResultScoreboard {...commonProps} />;
    case 'group_matches':
      return <GroupMatchesScoreboard {...commonProps} />;
    default:
      return (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Unknown scoreboard type: {scoreboard.scoreboard_type}
          </CardContent>
        </Card>
      );
  }
};

export default ScoreboardRenderer;
