import React from "react";
import type { MatchState } from "@/types/tournament";

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

const ScoreChip: React.FC<{
  score: number;
  par: number;
  isWinner: boolean;
  winColor?: string;
}> = ({ score, par, isWinner, winColor }) => {
  const diff = score - par;
  let color = "hsl(var(--muted-foreground))";
  let bg = "transparent";
  let isCircle = false;

  if (diff <= -2) {
    color = "#FFD700";
    bg = "#FFD70018";
    isCircle = true;
  } // eagle+
  else if (diff === -1) {
    color = "#FF6B6B";
    bg = "#FF6B6B18";
  } // birdie
  else if (diff === 0) {
    color = "hsl(var(--foreground))";
  } // par
  else if (diff === 1) {
    color = "#3A86FF";
  } // bogey
  else {
    color = "hsl(var(--muted-foreground) / 0.4)";
  } // double+

  if (isWinner && winColor) {
    color = winColor;
    bg = winColor + "20";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: isCircle ? "50%" : 6,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "monospace",
        border: isCircle ? `1px solid ${color}50` : undefined,
        flexShrink: 0,
      }}
    >
      {score}
    </span>
  );
};

const TournamentHoleTracker: React.FC<Props> = ({
  holeResults,
  teamMatchup,
  teams,
  courseHoles,
  gameType,
  teamAssignments,
  matchState,
}) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];

  // Completed holes
  const completedHoles = courseHoles
    .filter((h) => {
      const r = holeResults[h.number];
      return r && r.resultLabel && r.resultLabel !== "";
    })
    .sort((a, b) => b.number - a.number);

  // Unplayed holes after match complete (#62)
  const completedSet = new Set(completedHoles.map((h) => h.number));
  const unplayedHoles = matchState?.isComplete
    ? courseHoles.filter((h) => !completedSet.has(h.number)).sort((a, b) => b.number - a.number)
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
    const vals = playerIds.map((pid) => scores[pid]).filter((v): v is number => v !== undefined);
    if (vals.length === 0) return undefined;
    // For best ball / match play, use best (min). For sum-based, engine already provides team totals.
    return Math.min(...vals);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Column headers */}
      <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamA?.color }}>
          {teamA?.name.split(" ")[0]}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamB?.color }}>
          {teamB?.name.split(" ")[0]}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">
          Result
        </span>
      </div>

      <div className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
        {completedHoles.map((hole, idx) => {
          const r = holeResults[hole.number];
          if (!r) return null;

          const aPts = r.teamPoints[teamMatchup.teamAId] || 0;
          const bPts = r.teamPoints[teamMatchup.teamBId] || 0;
          const isAWin = aPts > bPts;
          const isBWin = bPts > aPts;
          const isHalved = aPts === bPts && aPts > 0;

          const aScore = getTeamScore(r, teamMatchup.teamAId);
          const bScore = getTeamScore(r, teamMatchup.teamBId);

          const winnerColor = isAWin ? teamA?.color : isBWin ? teamB?.color : undefined;
          const winPts = Math.max(aPts, bPts);

          return (
            <div
              key={hole.number}
              className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${
                idx % 2 !== 0 ? "bg-muted/20" : ""
              }`}
            >
              {/* Hole + par */}
              <div className="flex items-baseline gap-1">
                <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
              </div>

              {/* Score A */}
              <div className="flex justify-center">
                {aScore !== undefined ? (
                  <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA?.color} />
                ) : (
                  <span className="text-muted-foreground/30 text-sm">—</span>
                )}
              </div>

              {/* Score B */}
              <div className="flex justify-center">
                {bScore !== undefined ? (
                  <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB?.color} />
                ) : (
                  <span className="text-muted-foreground/30 text-sm">—</span>
                )}
              </div>

              {/* Result */}
              <div className="flex justify-end">
                {isHalved ? (
                  <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                ) : isAWin || isBWin ? (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{
                      color: winnerColor,
                      backgroundColor: winnerColor ? winnerColor + "18" : undefined,
                    }}
                  >
                    +{winPts}pt
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40">—</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Unplayed holes after match complete (#62) */}
        {unplayedHoles.map((hole) => (
          <div
            key={`unplayed-${hole.number}`}
            className="grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-25"
          >
            <div className="flex items-baseline gap-1">
              <span className="text-[13px] font-bold font-mono">{hole.number}</span>
              <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
            </div>
            <span className="text-center text-muted-foreground text-sm">—</span>
            <span className="text-center text-muted-foreground text-sm">—</span>
            <span className="text-right text-muted-foreground text-xs">—</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentHoleTracker;
