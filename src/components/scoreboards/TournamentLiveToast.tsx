import React, { useEffect, useState } from 'react';

interface Props {
  newHoleResult: any | null;
  teams: any[];
  players: any[];
  groupPlayers: Record<string, any[]>;
  holeResults: any[];
}

const TournamentLiveToast: React.FC<Props> = ({ newHoleResult, teams, players, groupPlayers, holeResults }) => {
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<{ playerName: string; hole: number; teamColor: string; message: string } | null>(null);

  useEffect(() => {
    if (!newHoleResult) return;

    const groupId = newHoleResult.tournament_group_id;
    const holeNum = newHoleResult.hole_number;

    // Find a player from this group
    const gps = groupPlayers[groupId] || [];
    const firstGp = gps[0];
    const player = firstGp ? players.find((p: any) => p.id === firstGp.tournament_player_id) : null;
    const playerName = player?.display_name?.split(' ')[0] || 'Player';

    // Team color - find leading team
    const tp = newHoleResult.team_points as Record<string, number>;
    let leadTeamId = '';
    let maxPts = -1;
    if (tp) {
      Object.entries(tp).forEach(([tid, pts]) => {
        if (Number(pts) > maxPts) { maxPts = Number(pts); leadTeamId = tid; }
      });
    }
    const leadTeam = teams.find((t: any) => t.id === leadTeamId);
    const teamColor = leadTeam?.color || 'hsl(var(--primary))';

    // Build overall totals for message
    const teamTotals: Record<string, number> = {};
    teams.forEach((t: any) => { teamTotals[t.id] = 0; });
    holeResults.forEach((hr: any) => {
      const hrTp = hr.team_points as Record<string, number>;
      if (hrTp) {
        Object.entries(hrTp).forEach(([tid, pts]) => {
          teamTotals[tid] = (teamTotals[tid] || 0) + Number(pts);
        });
      }
    });

    const teamArr = teams.filter((t: any) => teamTotals[t.id] !== undefined);
    if (teamArr.length >= 2) {
      const [t1, t2] = teamArr;
      const p1 = teamTotals[t1.id] || 0;
      const p2 = teamTotals[t2.id] || 0;
      let msg: string;
      if (p1 === p2) {
        msg = `Match level — ${p1} all`;
      } else {
        const leader = p1 > p2 ? t1 : t2;
        const leaderPts = Math.max(p1, p2);
        const trailerPts = Math.min(p1, p2);
        msg = `${leader.name} leads — ${leaderPts} to ${trailerPts}`;
      }

      setContent({ playerName, hole: holeNum, teamColor, message: msg });
      setVisible(true);

      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [newHoleResult]);

  if (!visible || !content) return null;

  return (
    <div
      className="fixed top-16 left-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-3 animate-fade-in"
      style={{ borderLeftWidth: '4px', borderLeftColor: content.teamColor }}
    >
      <p className="text-sm font-medium">
        {content.playerName} finished hole {content.hole}
      </p>
      <p className="text-xs text-muted-foreground">{content.message}</p>
    </div>
  );
};

export default TournamentLiveToast;
