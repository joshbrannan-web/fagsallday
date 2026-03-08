import React from "react";
import type { TournamentPlayer } from "@/types/tournament";

interface Props {
  players: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  allHoleScores: Record<string, Record<number, number>>;
  holeResults: Record<number, { netScores?: Record<string, number>; playerPoints?: Record<string, number> }>;
  holesPlayed: number;
}

const TournamentPlayerSummary: React.FC<Props> = ({ players, teamAssignments, teams, allHoleScores, holeResults }) => {
  const playerData = players.map((p) => {
    const teamId = teamAssignments[p.id];
    const team = teams[teamId];
    let grossTotal = 0,
      netTotal = 0,
      ptsTotal = 0;

    Object.entries(allHoleScores[p.id] || {}).forEach(([h, score]) => {
      grossTotal += score;
      const nr = holeResults[Number(h)]?.netScores?.[p.id];
      netTotal += nr ?? score;
    });

    Object.values(holeResults).forEach((hr) => {
      const pp = hr.playerPoints?.[p.id];
      if (pp !== undefined) ptsTotal += pp;
    });

    return { player: p, teamId, team, grossTotal, netTotal, ptsTotal };
  });

  // Group by team
  const teamIds = [...new Set(playerData.map((d) => d.teamId))].filter(Boolean).sort();

  if (teamIds.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {teamIds.map((tid) => {
        const team = teams[tid];
        const teamPlayers = playerData.filter((d) => d.teamId === tid);

        return (
          <div key={tid} className="rounded-xl border border-border overflow-hidden bg-card">
            {/* Team header */}
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-border"
              style={{ borderBottomColor: team?.color + "40", backgroundColor: team?.color + "0f" }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team?.color }} />
              <span className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: team?.color }}>
                {team?.name}
              </span>
            </div>

            {/* Players */}
            {teamPlayers.map((d, i) => (
              <div
                key={d.player.id}
                className={`px-3 py-2.5 ${i < teamPlayers.length - 1 ? "border-b border-border/50" : ""}`}
              >
                <p className="text-[13px] font-semibold text-foreground truncate mb-1.5">{d.player.displayName}</p>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Gross</span>
                    <span className="text-[13px] font-bold font-mono text-foreground">{d.grossTotal || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Net</span>
                    <span className="text-[13px] font-bold font-mono text-muted-foreground">{d.netTotal || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Pts</span>
                    <span className="text-[13px] font-bold font-mono" style={{ color: team?.color }}>
                      {d.ptsTotal}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default TournamentPlayerSummary;
