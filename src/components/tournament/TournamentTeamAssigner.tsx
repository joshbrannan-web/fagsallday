import React from 'react';
import { Lock } from 'lucide-react';

interface TournamentPlayer {
  id: string;
  display_name: string;
  team_id: string | null;
  user_id?: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Props {
  players: TournamentPlayer[];
  teams: Team[];
  teamAssignments: Record<string, string>;
  currentUserId?: string;
}

const TournamentTeamAssigner: React.FC<Props> = ({ players, teams, teamAssignments, currentUserId }) => {
  const teamGroups: Record<string, TournamentPlayer[]> = {};
  teams.forEach(t => { teamGroups[t.id] = []; });

  players.forEach(p => {
    const tid = teamAssignments[p.id];
    if (tid && teamGroups[tid]) {
      teamGroups[tid].push(p);
    }
  });

  const teamList = teams.filter(t => teamGroups[t.id]?.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {teamList.map((team, idx) => (
          <React.Fragment key={team.id}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                <span className="font-semibold">{team.name}</span>
              </div>
              {teamGroups[team.id].map(p => {
                const isCurrentUser = currentUserId && p.user_id === currentUserId;
                return (
                  <div key={p.id} className="p-2 rounded-lg bg-card border border-border text-sm flex items-center gap-2">
                    <span className="flex-1">{p.display_name}</span>
                    {isCurrentUser && (
                      <>
                        <span className="text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">You</span>
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {idx === 0 && teamList.length === 2 && (
              <div className="flex items-center justify-center col-span-2 -my-2">
                <span className="text-lg font-bold text-muted-foreground">vs</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default TournamentTeamAssigner;
