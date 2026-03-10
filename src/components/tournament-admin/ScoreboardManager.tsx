import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Edit2, Trash2, Plus, ChevronUp, ChevronDown, Eye, Sparkles, Check } from 'lucide-react';
import ScoreboardRenderer from '@/components/scoreboards/ScoreboardRenderer';

const SB_TYPES = [
  { value: 'team_points', label: 'Team Points' },
  { value: 'individual_gross', label: 'Individual Gross Scores' },
  { value: 'individual_net', label: 'Individual Net Scores' },
  { value: 'individual_points', label: 'Individual Points Won' },
  { value: 'team_round_result', label: 'Team Round Result' },
  { value: 'individual_round_result', label: 'Individual Round Result' },
  { value: 'group_matches', label: 'Live Group Matches' },
];

const SORT_METRICS = [
  { value: 'total_points', label: 'Total Points' },
  { value: 'gross_score', label: 'Gross Score' },
  { value: 'net_score', label: 'Net Score' },
  { value: 'wins', label: 'Wins' },
];

interface Suggestion {
  name: string;
  scoreboard_type: string;
  sort_metric: string;
  sort_direction: string;
  show_round_breakdown: boolean;
  reason: string;
}

function generateSuggestions(teams: any[], games: any[], existingScoreboards: any[]): Suggestion[] {
  const existingTypes = new Set(existingScoreboards.map((s: any) => s.scoreboard_type));
  const suggestions: Suggestion[] = [];

  const hasTeams = teams.length >= 2;
  const hasHandicaps = games.some((g: any) => g.use_handicaps);

  if (hasTeams && !existingTypes.has('team_points')) {
    suggestions.push({ name: 'Team Points', scoreboard_type: 'team_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true, reason: 'Track cumulative team points across rounds' });
  }
  if (hasTeams && !existingTypes.has('team_round_result')) {
    suggestions.push({ name: 'Team Round Result', scoreboard_type: 'team_round_result', sort_metric: 'wins', sort_direction: 'desc', show_round_breakdown: true, reason: 'Show which team won each round' });
  }
  if (hasHandicaps && !existingTypes.has('individual_net')) {
    suggestions.push({ name: 'Individual Net Scores', scoreboard_type: 'individual_net', sort_metric: 'net_score', sort_direction: 'asc', show_round_breakdown: true, reason: 'Handicaps are active — rank by net score' });
  }
  if (!existingTypes.has('individual_gross')) {
    suggestions.push({ name: 'Individual Gross Scores', scoreboard_type: 'individual_gross', sort_metric: 'gross_score', sort_direction: 'asc', show_round_breakdown: true, reason: 'Rank players by raw stroke total' });
  }
  if (!existingTypes.has('individual_points')) {
    suggestions.push({ name: 'Individual Points', scoreboard_type: 'individual_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true, reason: 'Rank players by match points earned' });
  }
  if (!existingTypes.has('group_matches')) {
    suggestions.push({ name: 'Live Group Matches', scoreboard_type: 'group_matches', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: false, reason: 'Show real-time match status for all groups' });
  }

  return suggestions;
}

function generateMockData(teams: any[], players: any[], rounds: any[]) {
  const mockTeams = teams.length >= 2 ? teams : [
    { id: 'mock-a', name: 'Team A', color: '#3b82f6', display_order: 0 },
    { id: 'mock-b', name: 'Team B', color: '#ef4444', display_order: 1 },
  ];
  const mockPlayers = players.length > 0 ? players : [
    { id: 'mp1', display_name: 'Player 1', team_id: mockTeams[0].id, handicap_index: 10 },
    { id: 'mp2', display_name: 'Player 2', team_id: mockTeams[0].id, handicap_index: 15 },
    { id: 'mp3', display_name: 'Player 3', team_id: mockTeams[1].id, handicap_index: 8 },
    { id: 'mp4', display_name: 'Player 4', team_id: mockTeams[1].id, handicap_index: 12 },
  ];
  const mockRounds = rounds.length > 0 ? rounds.map((r: any) => ({ ...r, status: 'completed' })) : [
    { id: 'mr1', round_number: 1, status: 'completed', course_data: { name: 'Sample Course', holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3, handicapIndex: i + 1, yards: 350 + i * 10 })) } },
  ];

  // Generate mock group & scores
  const groupId = 'mock-group-1';
  const mockGroups: Record<string, any[]> = {
    [mockRounds[0].id]: [{ id: groupId, tournament_round_id: mockRounds[0].id, group_number: 1, status: 'active', team_matchup: { teamAId: mockTeams[0].id, teamBId: mockTeams[1].id } }],
  };
  const mockGroupPlayers: Record<string, any[]> = {
    [groupId]: mockPlayers.map(p => ({ id: `gp-${p.id}`, tournament_group_id: groupId, tournament_player_id: p.id, team_id: p.team_id })),
  };

  // Generate fake hole results (9 holes played)
  const holesPlayed = 9;
  const mockHoleResults: any[] = [];
  const mockHoleScores: any[] = [];
  for (let h = 1; h <= holesPlayed; h++) {
    const winnerIdx = h % 3; // alternate winners
    const tp: Record<string, number> = {};
    const pp: Record<string, number> = {};
    if (winnerIdx === 0) {
      tp[mockTeams[0].id] = 1; tp[mockTeams[1].id] = 0;
    } else if (winnerIdx === 1) {
      tp[mockTeams[1].id] = 1; tp[mockTeams[0].id] = 0;
    } else {
      tp[mockTeams[0].id] = 0.5; tp[mockTeams[1].id] = 0.5;
    }
    mockPlayers.forEach(p => { pp[p.id] = tp[p.team_id] || 0; });
    mockHoleResults.push({ id: `hr-${h}`, tournament_group_id: groupId, hole_number: h, team_points: tp, player_points: pp, points_value: 1, result_label: winnerIdx === 2 ? 'Halved' : winnerIdx === 0 ? `${mockTeams[0].name} wins` : `${mockTeams[1].name} wins` });

    mockPlayers.forEach(p => {
      const par = h % 3 === 0 ? 5 : h % 3 === 1 ? 4 : 3;
      mockHoleScores.push({ id: `hs-${h}-${p.id}`, tournament_group_id: groupId, tournament_player_id: p.id, hole_number: h, gross_score: par + Math.floor(Math.random() * 3) - 1, is_super_user_override: false });
    });
  }

  const mockGames: Record<string, any> = {};
  mockRounds.forEach((r: any) => {
    mockGames[r.id] = { id: `game-${r.id}`, tournament_round_id: r.id, game_type: 'match_play_best_ball', default_points_per_hole: 1, halved_hole_rule: 'half_point', use_handicaps: false, handicap_allowance_percent: 100, second_ball_tiebreaker: false };
  });

  return {
    teams: mockTeams,
    rounds: mockRounds,
    players: mockPlayers,
    groups: mockGroups,
    groupPlayers: mockGroupPlayers,
    holeResults: mockHoleResults,
    holeScores: mockHoleScores,
    games: mockGames,
    tournamentStatus: 'active',
    teamScoringMethod: 'cumulative' as const,
  };
}

interface Props {
  scoreboards: any[];
  teams?: any[];
  games?: any[];
  players?: any[];
  rounds?: any[];
  onAdd: (data: any) => Promise<void>;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ScoreboardManager: React.FC<Props> = ({ scoreboards, teams = [], games = [], players = [], rounds = [], onAdd, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', scoreboard_type: 'team_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true });
  const [previewSuggestion, setPreviewSuggestion] = useState<Suggestion | null>(null);

  const suggestions = useMemo(() => generateSuggestions(teams, games, scoreboards), [teams, games, scoreboards]);
  const mockData = useMemo(() => generateMockData(teams, players, rounds), [teams, players, rounds]);

  const openNew = () => {
    setForm({ name: '', scoreboard_type: 'team_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true });
    setEditing('new');
  };

  const openEdit = (sb: any) => {
    setForm({
      name: sb.name,
      scoreboard_type: sb.scoreboard_type,
      sort_metric: sb.sort_metric,
      sort_direction: sb.sort_direction || 'desc',
      show_round_breakdown: sb.show_round_breakdown ?? true,
    });
    setEditing(sb);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing === 'new') await onAdd(form);
    else await onUpdate(editing.id, form);
    setEditing(null);
  };

  const handleAddSuggestion = async (s: Suggestion) => {
    const { reason, ...data } = s;
    await onAdd(data);
  };

  const sorted = [...scoreboards].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const handleSwap = async (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[targetIdx];
    const aOrder = a.display_order ?? idx;
    const bOrder = b.display_order ?? targetIdx;
    await onUpdate(a.id, { display_order: bOrder });
    await onUpdate(b.id, { display_order: aOrder });
  };

  return (
    <div className="space-y-6">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            Suggested Scoreboards
          </div>
          {suggestions.map((s) => (
            <Card key={s.scoreboard_type} className="p-3 border-dashed">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setPreviewSuggestion(s)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => handleAddSuggestion(s)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Existing scoreboards */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          {suggestions.length > 0 && (
            <div className="text-sm font-semibold text-muted-foreground">Active Scoreboards</div>
          )}
          {sorted.map((sb: any, idx: number) => (
            <Card key={sb.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => handleSwap(idx, 'up')}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sorted.length - 1} onClick={() => handleSwap(idx, 'down')}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div>
                  <p className="font-medium text-sm">{sb.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {SB_TYPES.find(t => t.value === sb.scoreboard_type)?.label} • {sb.sort_direction === 'desc' ? 'High → Low' : 'Low → High'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sb)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(sb.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={openNew}>
        <Plus className="w-4 h-4 mr-1" /> Add Scoreboard
      </Button>

      {/* Edit / New Sheet */}
      <Sheet open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing === 'new' ? 'New Scoreboard' : 'Edit Scoreboard'}</SheetTitle>
            <SheetDescription>Configure scoreboard display settings</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Team Race" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.scoreboard_type} onValueChange={v => setForm(f => ({ ...f, scoreboard_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SB_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Metric</Label>
              <Select value={form.sort_metric} onValueChange={v => setForm(f => ({ ...f, sort_metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Direction</Label>
              <Select value={form.sort_direction} onValueChange={v => setForm(f => ({ ...f, sort_direction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High → Low</SelectItem>
                  <SelectItem value="asc">Low → High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Round Breakdown</Label>
              <Switch checked={form.show_round_breakdown} onCheckedChange={v => setForm(f => ({ ...f, show_round_breakdown: v }))} />
            </div>
            <Button className="w-full" onClick={handleSave}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview Sheet */}
      <Sheet open={!!previewSuggestion} onOpenChange={open => !open && setPreviewSuggestion(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Preview: {previewSuggestion?.name}</SheetTitle>
            <SheetDescription>Example data based on your tournament setup</SheetDescription>
          </SheetHeader>
          <div className="mt-4 pb-20">
            {previewSuggestion && (
              <>
                <div className="mb-4">
                  <ScoreboardRenderer
                    scoreboard={{ scoreboard_type: previewSuggestion.scoreboard_type, name: previewSuggestion.name, id: 'preview' }}
                    data={mockData}
                    joinCode="DEMO"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { handleAddSuggestion(previewSuggestion); setPreviewSuggestion(null); }}>
                    <Check className="w-4 h-4 mr-1" /> Add This Scoreboard
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setPreviewSuggestion(null)}>
                    Dismiss
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ScoreboardManager;
