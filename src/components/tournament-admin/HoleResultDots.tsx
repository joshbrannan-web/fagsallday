import React from 'react';

interface HoleResult {
  holeNumber: number;
  winningTeamColor?: string;
  isHalved: boolean;
  isPlayed: boolean;
}

interface Props {
  results: HoleResult[];
}

const HoleResultDots: React.FC<Props> = ({ results }) => {
  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {results.map((r, i) => (
        <div
          key={i}
          className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[8px] font-bold"
          style={r.isPlayed && r.winningTeamColor && !r.isHalved ? { backgroundColor: r.winningTeamColor, borderColor: r.winningTeamColor } : undefined}
          title={`Hole ${r.holeNumber}`}
        >
          {r.isPlayed && r.isHalved && <span className="text-muted-foreground">½</span>}
          {!r.isPlayed && <span className="text-muted-foreground/30">{r.holeNumber}</span>}
        </div>
      ))}
    </div>
  );
};

export default HoleResultDots;
