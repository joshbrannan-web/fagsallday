import React from 'react';

interface Props {
  leadingTeamName?: string;
  leadingTeamColor?: string;
  leadAmount: number;
  holesPlayed: number;
  isComplete: boolean;
  resultLabel: string;
}

const MatchStatusBar: React.FC<Props> = ({ leadingTeamName, leadingTeamColor, leadAmount, holesPlayed, isComplete, resultLabel }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-2xl font-bold" style={leadingTeamColor ? { color: leadingTeamColor } : undefined}>
        {resultLabel || 'ALL SQUARE'}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {isComplete ? 'Final' : `Thru ${holesPlayed}`}
      </p>
    </div>
  );
};

export default MatchStatusBar;
