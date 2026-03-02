import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  teams: any[];
  players: any[];
  onUpdateTeam: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onUpdatePlayer: (id: string, updates: { team_id?: string }) => Promise<void>;
  onAddTeam: (data: { name: string; color: string }) => Promise<void>;
  onDeleteTeam: (id: string) => Promise<void>;
}

const TeamListAdmin: React.FC<Props> = ({ teams, players, onUpdateTeam, onUpdatePlayer, onAddTeam, onDeleteTeam }) => {
  return (
    <div className="space-y-4">
      {teams.map((team: any) => {
        const teamPlayers = players.filter((p: any) => p.team_id === team.id);
        return (
          <Card key={team.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={team.color}
                onChange={e => onUpdateTeam(team.id, { color: e.target.value })}
                className="w-8 h-8 rounded border border-input cursor-pointer p-0.5"
              />
              <Input
                value={team.name}
                onChange={e => onUpdateTeam(team.id, { name: e.target.value })}
                className="flex-1 font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteTeam(team.id)}
                disabled={teamPlayers.length > 0}
                className="text-muted-foreground"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1.5 pl-1">
              {teamPlayers.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.display_name}</span>
                  <Select value={p.team_id} onValueChange={v => onUpdatePlayer(p.id, { team_id: v })}>
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {teamPlayers.length === 0 && <p className="text-xs text-muted-foreground italic">No players</p>}
            </div>
          </Card>
        );
      })}

      {teams.length < 8 && (
        <Button variant="outline" className="w-full" onClick={() => onAddTeam({ name: `Team ${String.fromCharCode(65 + teams.length)}`, color: '#6b7280' })}>
          <Plus className="w-4 h-4 mr-1" /> Add Team
        </Button>
      )}
    </div>
  );
};

export default TeamListAdmin;
