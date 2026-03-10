import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Player {
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

interface Group {
  id: string;
  group_number: number;
  status: string;
}

interface GroupPlayer {
  tournament_group_id: string;
  tournament_player_id: string;
  team_id: string;
}

interface TournamentGroupSelectorProps {
  groups: Group[];
  groupPlayers: GroupPlayer[];
  players: Player[];
  teams: Team[];
  selectedGroupId: string | null;
  currentUserId: string | undefined;
  onSelect: (groupId: string) => void;
}

const TournamentGroupSelector: React.FC<TournamentGroupSelectorProps> = ({
  groups, groupPlayers, players, teams, selectedGroupId, currentUserId, onSelect,
}) => {
  return (
    <div className="space-y-3">
      {groups.map(group => {
        const gPlayers = groupPlayers
          .filter(gp => gp.tournament_group_id === group.id)
          .map(gp => ({
            ...gp,
            player: players.find(p => p.id === gp.tournament_player_id),
            team: teams.find(t => t.id === gp.team_id),
          }));

        const containsCurrentUser = gPlayers.some(gp => gp.player?.user_id === currentUserId);
        const isSelected = selectedGroupId === group.id;
        const isAlreadyActive = group.status === 'active' || group.status === 'submitted';

        return (
          <Card
            key={group.id}
            className={`p-3 cursor-pointer transition-all border-2 ${
              isSelected
                ? 'border-primary bg-primary/5'
                : containsCurrentUser
                ? 'border-[hsl(var(--brand-gold))]/50 bg-[hsl(var(--brand-gold))]/5'
                : 'border-border hover:border-muted-foreground/30'
            } ${isAlreadyActive ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !isAlreadyActive && onSelect(group.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Group {group.group_number}</span>
              <div className="flex items-center gap-1.5">
                {containsCurrentUser && (
                  <Badge variant="outline" className="text-[10px] border-[hsl(var(--brand-gold))]/50 text-[hsl(var(--brand-gold))]">
                    Your Group
                  </Badge>
                )}
                {isAlreadyActive && (
                  <Badge variant="secondary" className="text-[10px]">In Progress</Badge>
                )}
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {gPlayers.map(gp => (
                <span key={gp.tournament_player_id} className="flex items-center gap-1 text-sm">
                  {gp.team && (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: gp.team.color }} />
                  )}
                  {gp.player?.display_name || 'Unknown'}
                </span>
              ))}
            </div>
          </Card>
        );
      })}
      {groups.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
          <p className="text-sm">No groups have been set up for this round yet.</p>
        </div>
      )}
    </div>
  );
};

export default TournamentGroupSelector;
