import React from "react";
import type { TournamentPlayer } from "@/types/tournament";

interface Props {
  players: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  allHoleScores: Record<string, Record<number, number>>;
  holeResults: Record<number, { netScores?: Record<string, number>; playerPoints?: Record<string, number> }>;
  holesPlayed: number;
  subMatchups?: { playerA: string; playerB: string }[];
  teamAId?: string;
}

const TournamentPlayerSummary: React.FC<Props> = ({ players, teamAssignments, teams, allHoleScores, holeResults, subMatchups, teamAId }) => {
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

  const has1v1 = subMatchups && subMatchups.length > 0;

  // 1v1 matchup pair layout
  if (has1v1) {
    const playerMap = Object.fromEntries(playerData.map(d => [d.player.id, d]));

    return (
      <div className="space-y-2">
        {subMatchups.map((sm, idx) => {
          const dA = playerMap[sm.playerA];
          const dB = playerMap[sm.playerB];
          if (!dA || !dB) return null;

          return (
            <div key={idx} className="rounded-xl border border-border overflow-hidden bg-card">
              {/* Match header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Match {idx + 1}</span>
                <span className="text-[10px] text-muted-foreground/50">
                  {dA.ptsTotal > dB.ptsTotal
                    ? `${dA.player.displayName.split(' ')[0]} ${dA.ptsTotal - dB.ptsTotal} UP`
                    : dB.ptsTotal > dA.ptsTotal
                    ? `${dB.player.displayName.split(' ')[0]} ${dB.ptsTotal - dA.ptsTotal} UP`
                    : 'All Square'}
                </span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border/50">
                {[dA, dB].map((d) => (
                  <div key={d.player.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.team?.color }} />
                      <p className="text-[13px] font-semibold text-foreground truncate">{d.player.displayName}</p>
                    </div>
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
                        <span className="text-[13px] font-bold font-mono" style={{ color: d.team?.color }}>
                          {d.ptsTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Default team-grouped layout
  const teamIds = [...new Set(playerData.map((d) => d.teamId))].filter(Boolean).sort();
  if (teamIds.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {teamIds.map((tid) => {
        const team = teams[tid];
        const teamPlayers = playerData.filter((d) => d.teamId === tid);

        return (
          <div key={tid} className="rounded-xl border border-border overflow-hidden bg-card">
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-border"
              style={{ borderBottomColor: team?.color + "40", backgroundColor: team?.color + "0f" }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team?.color }} />
              <span className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: team?.color }}>
                {team?.name}
              </span>
            </div>

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
