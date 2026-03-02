import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TeamData } from './WizardStepTeams';

export interface PlayerData {
  displayName: string;
  handicapIndex: number;
  teamIndex: number;
  userId?: string;
}

interface Props {
  players: PlayerData[];
  teams: TeamData[];
  onChange: (players: PlayerData[]) => void;
}

const WizardStepPlayers: React.FC<Props> = ({ players, teams, onChange }) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async (term: string) => {
    setSearch(term);
    if (term.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase.rpc('search_users_by_name', { search_term: term });
    setSearchResults(data || []);
    setSearching(false);
  };

  const addPlayer = (name: string, userId?: string) => {
    if (players.some(p => p.displayName.toLowerCase() === name.toLowerCase())) return;
    onChange([...players, { displayName: name, handicapIndex: 0, teamIndex: 0, userId }]);
    setSearch('');
    setSearchResults([]);
  };

  const updatePlayer = (idx: number, key: keyof PlayerData, value: any) => {
    const next = [...players];
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };

  const removePlayer = (idx: number) => onChange(players.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Add players and assign them to teams</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => doSearch(e.target.value)}
          placeholder="Search players by name..."
          className="pl-9"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map(r => (
              <button
                key={r.id}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm"
                onClick={() => addPlayer(r.display_name || 'Unknown', r.id)}
              >
                <span>{r.display_name}</span>
                <UserPlus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        )}
        {search.length >= 2 && searchResults.length === 0 && !searching && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3">
            <p className="text-sm text-muted-foreground mb-2">No users found</p>
            <Button size="sm" variant="outline" onClick={() => addPlayer(search)}>
              Add "{search}" manually
            </Button>
          </div>
        )}
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          {players.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
              <span className="flex-1 text-sm font-medium truncate">{p.displayName}</span>
              <Input
                type="number"
                value={p.handicapIndex}
                onChange={e => updatePlayer(idx, 'handicapIndex', parseFloat(e.target.value) || 0)}
                className="w-16 text-center text-sm h-8"
                step="0.1"
              />
              <Select value={String(p.teamIndex)} onValueChange={v => updatePlayer(idx, 'teamIndex', parseInt(v))}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t, ti) => (
                    <SelectItem key={ti} value={String(ti)}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePlayer(idx)}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WizardStepPlayers;
