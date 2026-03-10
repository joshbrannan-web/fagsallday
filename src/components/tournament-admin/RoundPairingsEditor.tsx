import React, { useState } from 'react';
import { Users, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

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
  tournament_round_id: string;
  status: string;
}

interface GroupPlayer {
  id: string;
  tournament_group_id: string;
  tournament_player_id: string;
  team_id: string;
}

interface RoundPairingsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundId: string;
  roundName: string;
  players: Player[];
  teams: Team[];
  groups: Group[];
  groupPlayers: GroupPlayer[];
  onAddGroup: (roundId: string, playerIds: string[]) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

const RoundPairingsEditor: React.FC<RoundPairingsEditorProps> = ({
  open, onOpenChange, roundId, roundName, players, teams, groups, groupPlayers,
  onAddGroup, onDeleteGroup,
}) => {
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const roundGroups = groups.filter(g => g.tournament_round_id === roundId);
  const roundGroupPlayerIds = new Set(
    groupPlayers.filter(gp => roundGroups.some(g => g.id === gp.tournament_group_id)).map(gp => gp.tournament_player_id)
  );

  const availablePlayers = players.filter(p => !roundGroupPlayerIds.has(p.id));

  const togglePlayer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleSaveGroup = async () => {
    if (selectedIds.length !== 2 && selectedIds.length !== 4) {
      toast.error('Select exactly 2 or 4 players');
      return;
    }
    setSaving(true);
    await onAddGroup(roundId, selectedIds);
    setSelectedIds([]);
    setAdding(false);
    setSaving(false);
  };

  const getTeam = (teamId: string | null) => teams.find(t => t.id === teamId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Set Pairings — {roundName}</SheetTitle>
          <SheetDescription>Create groups of 2 or 4 players for this round</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Existing groups */}
          {roundGroups.map(group => {
            const gPlayers = groupPlayers
              .filter(gp => gp.tournament_group_id === group.id)
              .map(gp => {
                const player = players.find(p => p.id === gp.tournament_player_id);
                const team = getTeam(gp.team_id);
                return { ...gp, player, team };
              });

            // Derive team matchup
            const teamIds = [...new Set(gPlayers.map(gp => gp.team_id).filter(Boolean))];
            const matchupTeams = teamIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);

            return (
              <Card key={group.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Group {group.group_number}</span>
                    {matchupTeams.length === 2 && (
                      <span className="text-xs text-muted-foreground">
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-0.5" style={{ backgroundColor: matchupTeams[0]!.color }} />
                        {matchupTeams[0]!.name} vs{' '}
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-0.5" style={{ backgroundColor: matchupTeams[1]!.color }} />
                        {matchupTeams[1]!.name}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDeleteGroup(group.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gPlayers.map(gp => (
                    <Badge key={gp.id} variant="secondary" className="flex items-center gap-1">
                      {gp.team && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gp.team.color }} />
                      )}
                      {gp.player?.display_name || 'Unknown'}
                      <span className="text-[10px] text-muted-foreground ml-0.5">
                        ({gp.player?.handicap_override ?? gp.player?.handicap_index ?? 0})
                      </span>
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })}

          {/* Add group form */}
          {adding ? (
            <Card className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">New Group</span>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setSelectedIds([]); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select 2 or 4 players ({selectedIds.length} selected)
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availablePlayers.map(p => {
                  const team = getTeam(p.team_id);
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${isChecked ? 'bg-primary/10' : ''}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => togglePlayer(p.id)}
                        disabled={!isChecked && selectedIds.length >= 4}
                      />
                      {team && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />}
                      <span className="text-sm flex-1">{p.display_name}</span>
                      <span className="text-xs text-muted-foreground">{p.handicap_override ?? p.handicap_index}</span>
                    </label>
                  );
                })}
                {availablePlayers.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">All players are already assigned to groups</p>
                )}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={saving || (selectedIds.length !== 2 && selectedIds.length !== 4)}
                onClick={handleSaveGroup}
              >
                Save Group ({selectedIds.length} players)
              </Button>
            </Card>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Group
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RoundPairingsEditor;
