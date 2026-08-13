import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Search, UserPlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  players: any[];
  teams: any[];
  onUpdatePlayer: (id: string, updates: any) => Promise<void>;
  onAddPlayer: (data: any) => Promise<void>;
  onRemovePlayer: (id: string) => Promise<void>;
}

const PlayerListAdmin: React.FC<Props> = ({ players, teams, onUpdatePlayer, onAddPlayer, onRemovePlayer }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; handicap_index?: number }[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const getTeam = (teamId: string) => teams.find((t: any) => t.id === teamId);

  const startEdit = (player: any) => {
    setEditingId(player.id);
    setEditValue(String(player.handicap_override ?? player.handicap_index));
  };

  const saveEdit = async (playerId: string) => {
    await onUpdatePlayer(playerId, { handicap_override: parseFloat(editValue) || 0 });
    setEditingId(null);
  };

  const resetOverride = async (playerId: string) => {
    await onUpdatePlayer(playerId, { handicap_override: null });
  };

  const doSearch = async (term: string) => {
    setSearch(term);
    if (term.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.rpc('search_users_by_name', { search_term: term });
    setSearchResults(data || []);
  };

  const handleAdd = async (name: string, handicap: number = 0, userId?: string) => {
    if (!teams[0]) { toast.error('Create a team first'); return; }
    await onAddPlayer({ display_name: name, handicap_index: handicap, team_id: teams[0].id, user_id: userId });
    setSearch('');
    setSearchResults([]);
    setShowSearch(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Players ({players.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setShowSearch(!showSearch)}>
          <UserPlus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => doSearch(e.target.value)} placeholder="Search players..." className="pl-9" />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searchResults.map(r => (
                <button key={r.id} className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm" onClick={() => handleAdd(r.display_name, r.handicap_index ?? 0, r.id)}>
                  <span>{r.display_name}</span>
                  <UserPlus className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && searchResults.length === 0 && (
            <Button size="sm" variant="outline" className="mt-1" onClick={() => handleAdd(search)}>Add "{search}" manually</Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {players.map((p: any) => {
          const team = getTeam(p.team_id);
          return (
            <div key={p.id} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2.5">
              <Select
                value={p.team_id ?? 'none'}
                onValueChange={v => onUpdatePlayer(p.id, { team_id: v === 'none' ? null : v })}
              >
                <SelectTrigger className="h-7 w-[110px] shrink-0 text-xs px-2">
                  <span className="flex items-center gap-1.5 truncate">
                    {team ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                        <span className="truncate">{team.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No team</span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex-1 text-sm font-medium truncate">{p.display_name}</span>
              {p.handicap_override !== null && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  HCP Override
                </Badge>
              )}
              {editingId === p.id ? (
                <div className="flex items-center gap-1">
                  <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-16 h-7 text-xs text-center" step="0.1" autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit(p.id)} />
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => saveEdit(p.id)}>Save</Button>
                </div>
              ) : (
                <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => startEdit(p)}>
                  HCP: {p.handicap_override ?? p.handicap_index}
                </button>
              )}
              {p.handicap_override !== null && editingId !== p.id && (
                <button className="text-[10px] text-primary underline" onClick={() => resetOverride(p.id)}>Reset</button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onRemovePlayer(p.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerListAdmin;
