import React from 'react';

interface HoleResultData {
  teamPoints: Record<string, number>;
  resultLabel?: string;
  grossScores?: Record<string, number>;
  netScores?: Record<string, number>;
  pointsValue?: number;
}

interface Props {
  holeResults: Record<number, HoleResultData>;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  courseHoles: { number: number; par: number }[];
  gameType?: string;
}

const TournamentHoleTracker: React.FC<Props> = ({ holeResults, teamMatchup, teams, courseHoles, gameType }) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];

  // Only show holes with a result (non-empty resultLabel & pointsValue > 0 or halved)
  const completedHoles = courseHoles
    .filter(h => {
      const r = holeResults[h.number];
      return r && r.resultLabel && r.resultLabel !== '';
    })
    .sort((a, b) => b.number - a.number); // Reverse chronological

  if (completedHoles.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground text-center">
          No holes completed yet — scores will appear here as you play.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="max-h-[340px] overflow-y-auto divide-y divide-border">
        {completedHoles.map((hole, idx) => {
          const r = holeResults[hole.number];
          if (!r) return null;

          const aPts = r.teamPoints[teamMatchup.teamAId] || 0;
          const bPts = r.teamPoints[teamMatchup.teamBId] || 0;
          const isAWin = aPts > bPts;
          const isBWin = bPts > aPts;
          const isHalved = aPts === bPts && aPts > 0;
          const isNoPoints = aPts === 0 && bPts === 0;

          const winnerColor = isAWin ? teamA?.color : isBWin ? teamB?.color : undefined;
          const winnerName = isAWin ? teamA?.name : isBWin ? teamB?.name : undefined;
          const winPts = Math.max(aPts, bPts);

          return (
            <div key={hole.number} className={`flex items-center justify-between px-3 py-2 text-sm ${idx % 2 === 0 ? '' : 'bg-muted/30'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground w-12">Hole {hole.number}</span>
                <span className="text-xs text-muted-foreground">Par {hole.par}</span>
              </div>

              <div className="flex items-center gap-2">
                {isAWin || isBWin ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: winnerColor }} />
                    <span className="text-xs font-semibold">{winnerName} +{winPts}pt</span>
                  </>
                ) : isHalved ? (
                  <span className="text-xs text-muted-foreground font-semibold">½ +{aPts} each</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No pts</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentHoleTracker;
