import React from 'react';
import { Check, Lock, AlertTriangle } from 'lucide-react';

interface TournamentPlayer {
  id: string;
  display_name: string;
  handicap_index: number;
  handicap_override: number | null;
  team_id: string | null;
  user_id: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Props {
  players: TournamentPlayer[];
  selectedPlayers: TournamentPlayer[];
  teams: Team[];
  currentUserId: string | undefined;
  requiredCount: number;
  onToggle: (player: TournamentPlayer) => void;
  isGrouped: (playerId: string) => boolean;
}

const TournamentPlayerSelector: React.FC<Props> = ({ players, selectedPlayers, teams, currentUserId, requiredCount, onToggle, isGrouped }) => {
  const getTeam = (teamId: string | null) => teams.find(t => t.id === teamId);
  const selectedIds = new Set(selectedPlayers.map(p => p.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select {requiredCount} players total (including yourself)</p>
      <div className="space-y-2">
        {players.map(player => {
          const isCurrentUser = player.user_id === currentUserId;
          const isSelected = selectedIds.has(player.id);
          const team = getTeam(player.team_id);
          const grouped = isGrouped(player.id);
          const effectiveHandicap = player.handicap_override ?? player.handicap_index;

          return (
            <button
              key={player.id}
              onClick={() => !isCurrentUser && onToggle(player)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              } ${isCurrentUser ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{player.display_name}</span>
                    {isCurrentUser && (
                      <>
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">You</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {team && (
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </span>
                    )}
                    <span>HCP {effectiveHandicap}</span>
                  </div>
                </div>
              </div>
              {grouped && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertTriangle className="w-3 h-3" /> In another group
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-center text-muted-foreground">
        {selectedPlayers.length} / {requiredCount} selected
      </p>
    </div>
  );
};

export default TournamentPlayerSelector;
