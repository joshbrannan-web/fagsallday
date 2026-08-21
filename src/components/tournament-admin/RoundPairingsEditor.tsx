import React, { useState, useMemo } from 'react';
import { Users, Plus, Trash2, X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  team_matchup: any;
  leader_player_id?: string | null;
}

interface GroupPlayer {
  id: string;
  tournament_group_id: string;
  tournament_player_id: string;
  team_id: string;
}

interface SubMatchup {
  playerA: string;
  playerB: string;
}

const ONE_V_ONE_TYPES = ['match_play_individual', 'alternate_shot_twosomes', 'scramble_2'];

interface RoundMatchRow {
  id: string;
  tournament_round_id: string;
  match_number: number;
  side_a: string[];
  side_b: string[];
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
  gameType?: string;
  onAddGroup: (roundId: string, playerIds: string[], subMatchups?: SubMatchup[], leaderPlayerId?: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  roundMatches?: RoundMatchRow[];
  onAddMatch?: (roundId: string, sideA: string[], sideB: string[]) => Promise<void>;
  onDeleteMatch?: (matchId: string) => Promise<void>;
}

const RoundPairingsEditor: React.FC<RoundPairingsEditorProps> = ({
  open, onOpenChange, roundId, roundName, players, teams, groups, groupPlayers,
  gameType, onAddGroup, onDeleteGroup,
  roundMatches = [], onAddMatch, onDeleteMatch,
}) => {
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [matchupStep, setMatchupStep] = useState(false);
  const [match1A, setMatch1A] = useState<string>('');
  const [match1B, setMatch1B] = useState<string>('');
  const [leaderId, setLeaderId] = useState<string>('');
  const [addingMatch, setAddingMatch] = useState(false);
  const [matchSides, setMatchSides] = useState<Record<string, 'A' | 'B'>>({});
  const [savingMatch, setSavingMatch] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ group: Group; scoredHoles: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestDeleteGroup = async (group: Group) => {
    const { count } = await supabase
      .from('tournament_hole_scores')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_group_id', group.id)
      .not('gross_score', 'is', null);
    setPendingDelete({ group, scoredHoles: count || 0 });
  };

  const confirmDeleteGroup = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    await onDeleteGroup(pendingDelete.group.id);
    setDeleting(false);
    setPendingDelete(null);
  };


  const is1v1 = gameType ? ONE_V_ONE_TYPES.includes(gameType) : false;
  const needs1v1Step = is1v1 && selectedIds.length === 4;

  const roundGroups = groups.filter(g => g.tournament_round_id === roundId);
  const roundGroupPlayerIds = new Set(
    groupPlayers.filter(gp => roundGroups.some(g => g.id === gp.tournament_group_id)).map(gp => gp.tournament_player_id)
  );
  const availablePlayers = players.filter(p => !roundGroupPlayerIds.has(p.id));

  // Derive match 2 players from those not in match 1
  const match2Players = useMemo(() => {
    return selectedIds.filter(id => id !== match1A && id !== match1B);
  }, [selectedIds, match1A, match1B]);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleProceed = () => {
    if (selectedIds.length !== 2 && selectedIds.length !== 4) {
      toast.error('Select exactly 2 or 4 players');
      return;
    }
    if (needs1v1Step) {
      // Default matchup: first two vs last two
      setMatch1A(selectedIds[0]);
      setMatch1B(selectedIds[1]);
      setMatchupStep(true);
    } else {
      handleSaveGroup();
    }
  };

  const handleSaveGroup = async (subMatchups?: SubMatchup[]) => {
    setSaving(true);
    await onAddGroup(roundId, selectedIds, subMatchups, leaderId || undefined);
    resetForm();
    setSaving(false);
  };

  const handleSaveWithMatchups = async () => {
    if (!match1A || !match1B || match2Players.length !== 2) {
      toast.error('Please assign all matchups');
      return;
    }
    const subMatchups: SubMatchup[] = [
      { playerA: match1A, playerB: match1B },
      { playerA: match2Players[0], playerB: match2Players[1] },
    ];
    await handleSaveGroup(subMatchups);
  };

  const resetForm = () => {
    setSelectedIds([]);
    setAdding(false);
    setMatchupStep(false);
    setMatch1A('');
    setMatch1B('');
    setLeaderId('');
  };

  const roundMatchesForRound = roundMatches.filter(m => m.tournament_round_id === roundId);
  const sideAIds = Object.entries(matchSides).filter(([, s]) => s === 'A').map(([id]) => id);
  const sideBIds = Object.entries(matchSides).filter(([, s]) => s === 'B').map(([id]) => id);

  const getTeam = (teamId: string | null) => teams.find(t => t.id === teamId);
  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);

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

            const teamIds = [...new Set(gPlayers.map(gp => gp.team_id).filter(Boolean))];
            const matchupTeams = teamIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);
            const subMatchups: SubMatchup[] = (group.team_matchup as any)?.subMatchups || [];

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
                  {gPlayers.map(gp => {
                    const isLeader = group.leader_player_id === gp.tournament_player_id;
                    return (
                      <Badge key={gp.id} variant="secondary" className="flex items-center gap-1">
                        {isLeader && <Crown className="w-3 h-3 text-primary" />}
                        {gp.team && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gp.team.color }} />
                        )}
                        {gp.player?.display_name || 'Unknown'}
                        <span className="text-[10px] text-muted-foreground ml-0.5">
                          ({gp.player?.handicap_override ?? gp.player?.handicap_index ?? 0})
                        </span>
                      </Badge>
                    );
                  })}
                </div>
                {/* Sub-matchup display */}
                {subMatchups.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">1v1 Matches</span>
                    {subMatchups.map((sm, i) => {
                      const pA = getPlayer(sm.playerA);
                      const pB = getPlayer(sm.playerB);
                      return (
                        <div key={i} className="text-xs text-foreground flex items-center gap-1">
                          {(() => { const tA = getTeam(pA?.team_id ?? null); return tA ? <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tA.color }} /> : null; })()}
                          <span className="font-medium">{pA?.display_name || '?'}</span>
                          <span className="text-muted-foreground">vs</span>
                          {(() => { const tB = getTeam(pB?.team_id ?? null); return tB ? <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tB.color }} /> : null; })()}
                          <span className="font-medium">{pB?.display_name || '?'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Cross-group matches */}
          {onAddMatch && onDeleteMatch && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Matches (cross-group)</span>
                {!addingMatch && (
                  <Button size="sm" variant="ghost" onClick={() => setAddingMatch(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Match
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use this when teammates or opponents are playing in different foursomes. Scores are pooled
                across the whole round, so a match is scored the same no matter which group each player is in.
              </p>

              {roundMatchesForRound.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                  <div className="text-xs">
                    <span className="font-medium">Match {m.match_number}: </span>
                    {(m.side_a || []).map(id => getPlayer(id)?.display_name || '?').join(' & ')}
                    <span className="text-muted-foreground"> vs </span>
                    {(m.side_b || []).map(id => getPlayer(id)?.display_name || '?').join(' & ')}
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive hover:text-destructive"
                    onClick={() => onDeleteMatch(m.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {roundMatchesForRound.length === 0 && !addingMatch && (
                <p className="text-xs text-muted-foreground">No cross-group matches — scoring stays per foursome.</p>
              )}

              {addingMatch && (
                <div className="space-y-2 pt-1 border-t border-border">
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {players.map(p => {
                      const team = getTeam(p.team_id);
                      const side = matchSides[p.id];
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-md">
                          {team && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />}
                          <span className="text-sm flex-1">{p.display_name}</span>
                          {(['A', 'B'] as const).map(s => (
                            <Button
                              key={s}
                              size="sm"
                              variant={side === s ? 'default' : 'outline'}
                              className="h-6 w-8 p-0 text-[11px]"
                              onClick={() => setMatchSides(prev => {
                                const next = { ...prev };
                                if (next[p.id] === s) delete next[p.id];
                                else next[p.id] = s;
                                return next;
                              })}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setAddingMatch(false); setMatchSides({}); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={savingMatch || sideAIds.length === 0 || sideBIds.length === 0}
                      onClick={async () => {
                        setSavingMatch(true);
                        await onAddMatch(roundId, sideAIds, sideBIds);
                        setMatchSides({});
                        setAddingMatch(false);
                        setSavingMatch(false);
                      }}
                    >
                      Save Match ({sideAIds.length}v{sideBIds.length})
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Add group form */}
          {adding ? (
            <Card className="p-3 space-y-3">
              {!matchupStep ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Group</span>
                    <Button size="sm" variant="ghost" onClick={resetForm}>
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
                  {/* Group Leader selector */}
                  {selectedIds.length >= 2 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium flex items-center gap-1"><Crown className="w-3 h-3" /> Group Leader (Scorekeeper)</span>
                      <Select value={leaderId} onValueChange={setLeaderId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select scorekeeper…" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedIds.map(id => {
                            const p = getPlayer(id);
                            return <SelectItem key={id} value={id}>{p?.display_name || id}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={saving || (selectedIds.length !== 2 && selectedIds.length !== 4)}
                    onClick={handleProceed}
                  >
                    {needs1v1Step ? 'Next: Assign Matches' : `Save Group (${selectedIds.length} players)`}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Assign 1v1 Matches</span>
                    <Button size="sm" variant="ghost" onClick={() => setMatchupStep(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose who plays who in each 1v1 match
                  </p>

                  {/* Match 1 */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Match 1</span>
                    <div className="flex items-center gap-2">
                      <Select value={match1A} onValueChange={setMatch1A}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Player A" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedIds.filter(id => id !== match1B).map(id => {
                            const p = getPlayer(id);
                            const t = getTeam(p?.team_id ?? null);
                            return <SelectItem key={id} value={id}><span className="flex items-center gap-1.5">{t && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: t.color }} />}{p?.display_name || id}</span></SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground font-medium">vs</span>
                      <Select value={match1B} onValueChange={setMatch1B}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Player B" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedIds.filter(id => id !== match1A).map(id => {
                            const p = getPlayer(id);
                            const t = getTeam(p?.team_id ?? null);
                            return <SelectItem key={id} value={id}><span className="flex items-center gap-1.5">{t && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: t.color }} />}{p?.display_name || id}</span></SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Match 2 (auto-derived) */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Match 2</span>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
                      <span className="text-xs flex-1 text-center font-medium flex items-center justify-center gap-1">
                        {(() => { const p = match2Players[0] ? getPlayer(match2Players[0]) : null; const t = getTeam(p?.team_id ?? null); return <>{t && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: t.color }} />}{p?.display_name || '—'}</>; })()}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">vs</span>
                      <span className="text-xs flex-1 text-center font-medium flex items-center justify-center gap-1">
                        {(() => { const p = match2Players[1] ? getPlayer(match2Players[1]) : null; const t = getTeam(p?.team_id ?? null); return <>{t && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: t.color }} />}{p?.display_name || '—'}</>; })()}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={saving || !match1A || !match1B || match2Players.length !== 2}
                    onClick={handleSaveWithMatchups}
                  >
                    Save Group with Matches
                  </Button>
                </>
              )}
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
