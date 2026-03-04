import React from 'react';
import type { MatchState } from '@/types/tournament';

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
  teamAssignments?: Record<string, string>;
  matchState?: MatchState;
}

const TournamentHoleTracker: React.FC<Props> = ({
  holeResults, teamMatchup, teams, courseHoles, gameType,
  teamAssignments, matchState,
}) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];

  // Completed holes
  const completedHoles = courseHoles
    .filter(h => {
      const r = holeResults[h.number];
      return r && r.resultLabel && r.resultLabel !== '';
    })
    .sort((a, b) => b.number - a.number);

  // Unplayed holes after match complete (#62)
  const completedSet = new Set(completedHoles.map(h => h.number));
  const unplayedHoles = matchState?.isComplete
    ? courseHoles.filter(h => !completedSet.has(h.number)).sort((a, b) => b.number - a.number)
    : [];

  if (completedHoles.length === 0 && unplayedHoles.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground text-center">
          No holes completed yet — scores will appear here as you play.
        </p>
      </div>
    );
  }

  // Compute team best score for a hole from net or gross scores
  const getTeamScore = (r: HoleResultData, teamId: string): number | undefined => {
    const scores = r.netScores || r.grossScores;
    if (!scores || !teamAssignments) return undefined;
    const playerIds = Object.entries(teamAssignments)
      .filter(([, tid]) => tid === teamId)
      .map(([pid]) => pid);
    const vals = playerIds.map(pid => scores[pid]).filter((v): v is number => v !== undefined);
    if (vals.length === 0) return undefined;
    // For best ball / match play, use best (min). For sum-based, engine already provides team totals.
    return Math.min(...vals);
  };

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

          // Team score comparison (#17)
          const aScore = getTeamScore(r, teamMatchup.teamAId);
          const bScore = getTeamScore(r, teamMatchup.teamBId);

          return (
            <div key={hole.number} className={`flex items-center justify-between px-3 py-2 text-sm ${idx % 2 === 0 ? '' : 'bg-muted/30'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground w-12">Hole {hole.number}</span>
                <span className="text-xs text-muted-foreground">Par {hole.par}</span>
              </div>

              {/* Team score comparison */}
              {aScore !== undefined && bScore !== undefined && (
                <div className="text-xs text-muted-foreground font-mono">
                  <span style={{ color: teamA?.color }}>{aScore}</span>
                  {' / '}
                  <span style={{ color: teamB?.color }}>{bScore}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {isAWin || isBWin ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: winnerColor }} />
                    <span className="text-xs font-semibold">{winnerName} +{winPts}pt</span>
                  </>
                ) : isHalved ? (
                  <span className="text-xs text-muted-foreground font-semibold">½ +{aPts} each</span>
                ) : isNoPoints ? (
                  <span className="text-xs text-muted-foreground">½ No pts</span>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Unplayed holes after match complete (#62) */}
        {unplayedHoles.map((hole, idx) => (
          <div key={`unplayed-${hole.number}`} className="flex items-center justify-between px-3 py-2 text-sm opacity-40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-muted-foreground w-12">Hole {hole.number}</span>
              <span className="text-xs text-muted-foreground">Par {hole.par}</span>
            </div>
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentHoleTracker;
