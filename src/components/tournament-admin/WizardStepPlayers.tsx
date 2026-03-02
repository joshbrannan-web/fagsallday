import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, UserPlus, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSavedPlayers } from '@/hooks/useSavedPlayers';
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
  const { savedPlayers, isLoading: loadingSaved } = useSavedPlayers();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isAlreadyAdded = (name: string) =>
    players.some(p => p.displayName.toLowerCase() === name.toLowerCase());

  // Filter saved players by search term
  const filteredSaved = savedPlayers.filter(sp => {
    if (isAlreadyAdded(sp.name)) return false;
    if (!search.trim()) return true;
    return sp.name.toLowerCase().includes(search.toLowerCase());
  });

  // Filter RPC results: exclude already-added AND saved player names (to avoid dupes)
  const savedNames = new Set(savedPlayers.map(sp => sp.name.toLowerCase()));
  const filteredSearchResults = searchResults.filter(
    r => !isAlreadyAdded(r.display_name) && !savedNames.has(r.display_name.toLowerCase())
  );

  const doSearch = (term: string) => {
    setSearch(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc('search_users_by_name', { search_term: term.trim() });
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const addPlayer = (name: string, handicap: number = 0, userId?: string) => {
    if (isAlreadyAdded(name)) return;
    onChange([...players, { displayName: name, handicapIndex: handicap, teamIndex: 0, userId }]);
    setSearch('');
    setSearchResults([]);
  };

  const updatePlayer = (idx: number, key: keyof PlayerData, value: any) => {
    const next = [...players];
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };

  const removePlayer = (idx: number) => onChange(players.filter((_, i) => i !== idx));

  const hasSearch = search.trim().length >= 2;
  const noResults = hasSearch && !searching && filteredSaved.length === 0 && filteredSearchResults.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Add players and assign them to teams</p>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => doSearch(e.target.value)}
          placeholder="Search My Players or app users..."
          className="pl-9"
        />

        {/* Dropdown results when searching */}
        {hasSearch && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {/* My Players matches */}
            {filteredSaved.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">My Players</div>
                {filteredSaved.map(sp => (
                  <button
                    key={sp.id}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => addPlayer(sp.name, sp.handicap_index ?? 0, sp.linked_user_id ?? undefined)}
                  >
                    <span className="flex items-center gap-2">
                      <span>{sp.name}</span>
                      <span className="text-xs text-muted-foreground">({sp.handicap_index ?? 0})</span>
                    </span>
                    <UserPlus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}

            {/* App Users matches */}
            {filteredSearchResults.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">App Users</div>
                {filteredSearchResults.map(r => (
                  <button
                    key={r.id}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => addPlayer(r.display_name || 'Unknown', 0, r.id)}
                  >
                    <span>{r.display_name}</span>
                    <UserPlus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className="flex items-center justify-center py-3 gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            )}

            {noResults && (
              <div className="p-3">
                <p className="text-sm text-muted-foreground mb-2">No players found</p>
                <Button size="sm" variant="outline" onClick={() => addPlayer(search.trim())}>
                  Add "{search.trim()}" manually
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* My Players quick-add cards (when not searching) */}
      {!hasSearch && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">My Players</span>
          </div>
          {loadingSaved ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : filteredSaved.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No saved players available to add</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredSaved.map(sp => (
                <button
                  key={sp.id}
                  onClick={() => addPlayer(sp.name, sp.handicap_index ?? 0, sp.linked_user_id ?? undefined)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card hover:border-primary/50 text-sm transition-colors"
                >
                  <span className="font-medium">{sp.name}</span>
                  <span className="text-xs text-muted-foreground">({sp.handicap_index ?? 0})</span>
                  <UserPlus className="w-3.5 h-3.5 text-primary ml-1" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Added players list */}
      {players.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Tournament Players ({players.length})</div>
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
