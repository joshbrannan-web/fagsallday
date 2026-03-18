import React from "react";
import type { MatchState, TournamentPlayer } from "@/types/tournament";

interface HoleResultData {
  teamPoints: Record<string, number>;
  resultLabel?: string;
  grossScores?: Record<string, number>;
  netScores?: Record<string, number>;
  pointsValue?: number;
  playerPoints?: Record<string, number>;
}

interface Props {
  holeResults: Record<number, HoleResultData>;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  courseHoles: { number: number; par: number }[];
  gameType?: string;
  teamAssignments?: Record<string, string>;
  matchState?: MatchState;
  subMatchups?: { playerA: string; playerB: string }[];
  tournamentPlayers?: TournamentPlayer[];
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

  if (diff <= -2) { color = "#FFD700"; bg = "#FFD70018"; isCircle = true; }
  else if (diff === -1) { color = "#FF6B6B"; bg = "#FF6B6B18"; }
  else if (diff === 0) { color = "hsl(var(--foreground))"; }
  else if (diff === 1) { color = "#3A86FF"; }
  else { color = "hsl(var(--muted-foreground) / 0.4)"; }

  if (isWinner && winColor) { color = winColor; bg = winColor + "20"; }

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: isCircle ? "50%" : 6,
        background: bg, color, fontSize: 12, fontWeight: 700, fontFamily: "monospace",
        border: isCircle ? `1px solid ${color}50` : undefined, flexShrink: 0,
      }}
    >
      {score}
    </span>
  );
};

const TournamentHoleTracker: React.FC<Props> = ({
  holeResults, teamMatchup, teams, courseHoles, gameType, teamAssignments, matchState,
  subMatchups, tournamentPlayers,
}) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const has1v1 = subMatchups && subMatchups.length > 0 && tournamentPlayers;

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

  // For 1v1: show per-player scores instead of team best
  if (has1v1) {
    const playerMap = Object.fromEntries(tournamentPlayers!.map(p => [p.id, p]));
    const normalizeMatchup = (sm: { playerA: string; playerB: string }) =>
      teamAssignments?.[sm.playerA] === teamMatchup.teamAId ? sm : { playerA: sm.playerB, playerB: sm.playerA };

    return (
      <div className="space-y-2">
        {subMatchups!.map((rawSm, matchIdx) => {
          const sm = normalizeMatchup(rawSm);
          const pA = playerMap[sm.playerA];
          const pB = playerMap[sm.playerB];
          if (!pA || !pB) return null;

          const aTeamId = teamAssignments?.[sm.playerA];
          const bTeamId = teamAssignments?.[sm.playerB];
          const aColor = aTeamId ? teams[aTeamId]?.color : undefined;
          const bColor = bTeamId ? teams[bTeamId]?.color : undefined;

          return (
            <div key={matchIdx} className="rounded-xl border border-border overflow-hidden bg-card">
              {/* Match label */}
              <div className="px-3 py-1 bg-muted/30 border-b border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                  Match {matchIdx + 1}
                </span>
              </div>

              {/* Column headers with player names */}
              <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 border-b border-border">
                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: aColor }}>
                  {pA.displayName.split(" ")[0]}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: bColor }}>
                  {pB.displayName.split(" ")[0]}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">
                  Result
                </span>
              </div>

              <div className="max-h-[280px] overflow-y-auto divide-y divide-border/50">
                {completedHoles.map((hole, idx) => {
                  const r = holeResults[hole.number];
                  if (!r) return null;

                  // Per-player points for this matchup
                  const aPts = r.playerPoints?.[sm.playerA] || 0;
                  const bPts = r.playerPoints?.[sm.playerB] || 0;
                  const isAWin = aPts > bPts;
                  const isBWin = bPts > aPts;
                  const isHalved = aPts === bPts && aPts > 0;

                  const aNet = r.netScores?.[sm.playerA] ?? r.grossScores?.[sm.playerA];
                  const bNet = r.netScores?.[sm.playerB] ?? r.grossScores?.[sm.playerB];

                  const winnerColor = isAWin ? aColor : isBWin ? bColor : undefined;
                  const winPts = Math.max(aPts, bPts);

                  return (
                    <div
                      key={hole.number}
                      className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                        <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
                      </div>
                      <div className="flex justify-center">
                        {aNet !== undefined ? (
                          <ScoreChip score={aNet} par={hole.par} isWinner={isAWin} winColor={aColor} />
                        ) : (
                          <span className="text-muted-foreground/30 text-sm">—</span>
                        )}
                      </div>
                      <div className="flex justify-center">
                        {bNet !== undefined ? (
                          <ScoreChip score={bNet} par={hole.par} isWinner={isBWin} winColor={bColor} />
                        ) : (
                          <span className="text-muted-foreground/30 text-sm">—</span>
                        )}
                      </div>
                      <div className="flex justify-end">
                        {isHalved ? (
                          <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                        ) : isAWin || isBWin ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ color: winnerColor, backgroundColor: winnerColor ? winnerColor + "18" : undefined }}
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

                {unplayedHoles.map((hole) => (
                  <div key={`unplayed-${hole.number}`} className="grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-25">
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
        })}
      </div>
    );
  }

  // Default 2v2 team view
  const getTeamScore = (r: HoleResultData, teamId: string): number | undefined => {
    const scores = r.netScores || r.grossScores;
    if (!scores || !teamAssignments) return undefined;
    const playerIds = Object.entries(teamAssignments)
      .filter(([, tid]) => tid === teamId)
      .map(([pid]) => pid);
    const vals = playerIds.map((pid) => scores[pid]).filter((v): v is number => v !== undefined);
    if (vals.length === 0) return undefined;
    // For two_man_score, show combined sum; otherwise show best ball
    if (gameType === 'two_man_score') {
      return vals.reduce((a, b) => a + b, 0);
    }
    return Math.min(...vals);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamA?.color }}>
          {teamA?.name}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: teamB?.color }}>
          {teamB?.name}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">Result</span>
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
              className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}
            >
              <div className="flex items-baseline gap-1">
                <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
                <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
              </div>
              <div className="flex justify-center">
                {aScore !== undefined ? (
                  <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA?.color} />
                ) : (
                  <span className="text-muted-foreground/30 text-sm">—</span>
                )}
              </div>
              <div className="flex justify-center">
                {bScore !== undefined ? (
                  <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB?.color} />
                ) : (
                  <span className="text-muted-foreground/30 text-sm">—</span>
                )}
              </div>
              <div className="flex justify-end">
                {isHalved ? (
                  <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
                ) : isAWin || isBWin ? (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ color: winnerColor, backgroundColor: winnerColor ? winnerColor + "18" : undefined }}
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

        {unplayedHoles.map((hole) => (
          <div key={`unplayed-${hole.number}`} className="grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-25">
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
