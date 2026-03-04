import React from 'react';
import TeamPointsScoreboard from './TeamPointsScoreboard';
import IndividualGrossScoreboard from './IndividualGrossScoreboard';
import IndividualNetScoreboard from './IndividualNetScoreboard';
import IndividualPointsScoreboard from './IndividualPointsScoreboard';
import TeamRoundResultScoreboard from './TeamRoundResultScoreboard';
import IndividualRoundResultScoreboard from './IndividualRoundResultScoreboard';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  scoreboard: any;
  data: any;
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
