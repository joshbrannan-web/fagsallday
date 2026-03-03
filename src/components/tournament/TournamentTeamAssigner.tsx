import React from 'react';

interface TournamentPlayer {
  id: string;
  display_name: string;
  team_id: string | null;
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
}

const TournamentTeamAssigner: React.FC<Props> = ({ players, teams, teamAssignments }) => {
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
              {teamGroups[team.id].map(p => (
                <div key={p.id} className="p-2 rounded-lg bg-card border border-border text-sm">
                  {p.display_name}
                </div>
              ))}
            </div>
            {idx === 0 && teamList.length === 2 && (
              <div className="flex items-center justify-center col-span-2 -my-2">
                <span className="text-lg font-bold text-muted-foreground">vs</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      {teamList.length === 2 && (
        <div className="hidden" /> // This empty div prevents the "vs" from appearing at bottom
      )}
    </div>
  );
};

export default TournamentTeamAssigner;
