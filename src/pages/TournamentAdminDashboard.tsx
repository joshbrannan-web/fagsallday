import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { ArrowLeft, Copy, Flag, Users, Play, CheckCircle2, Pencil, Save, X, Trash2, Plus, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import TestRoundLauncher from '@/components/tournament-admin/TestRoundLauncher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import PlayerListAdmin from '@/components/tournament-admin/PlayerListAdmin';
import TeamListAdmin from '@/components/tournament-admin/TeamListAdmin';
import RoundConfigCard, { RoundConfigData, defaultRoundConfig } from '@/components/tournament-admin/RoundConfigCard';
import RoundResultsDashboard from '@/components/tournament-admin/RoundResultsDashboard';
import RoundPairingsEditor from '@/components/tournament-admin/RoundPairingsEditor';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  setup: 'bg-muted text-muted-foreground',
  active: 'bg-success/20 text-success',
  completed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

const roundStatusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-success/20 text-success',
  completed: 'bg-primary/20 text-primary',
};

/* ── helpers: map DB ↔ RoundConfigData ── */
function dbToRoundConfig(round: any, game: any, holePoints?: any[]): RoundConfigData {
  const base = defaultRoundConfig(round.round_number);
  return {
    ...base,
    name: round.name || base.name,
    roundDate: round.round_date || '',
    courseData: round.course_data || null,
    notes: round.notes || '',
    gameType: game?.game_type || '',
    defaultPointsPerHole: game?.default_points_per_hole ?? 1,
    halvedHoleRule: game?.halved_hole_rule || 'half_point',
    useHandicaps: game?.use_handicaps ?? true,
    handicapAllowancePercent: game?.handicap_allowance_percent ?? 100,
    maxScoreEnabled: !!game?.max_score_per_hole,
    maxScorePerHole: game?.max_score_per_hole || 4,
    secondBallTiebreaker: game?.second_ball_tiebreaker ?? false,
    sixesConfig: game?.sixes_config || base.sixesConfig,
    sixesFormat: (game?.sixes_format as RoundConfigData['sixesFormat']) || base.sixesFormat,
    sixesSegmentPoints: (game?.sixes_segment_points as RoundConfigData['sixesSegmentPoints']) || base.sixesSegmentPoints,
    holePointOverrides: holePoints && holePoints.length > 0
      ? Array.from({ length: 18 }, (_, i) => {
          const row = holePoints.find((hp: any) => hp.hole_number === i + 1);
          return row ? Number(row.points) : (game?.default_points_per_hole ?? 1);
        })
      : Array(18).fill(game?.default_points_per_hole ?? 1),
    holePointsCustomized: !!(holePoints && holePoints.length > 0),
    teamScoringMode: (round.team_scoring_mode as RoundConfigData['teamScoringMode']) || base.teamScoringMode,
    teamScoringPoints: { ...base.teamScoringPoints, ...(round.team_scoring_points || {}) },
  };
}

const teamScoringSummary = (round: any): string | null => {
  const pts = round.team_scoring_points || {};
  switch (round.team_scoring_mode) {
    case 'per_hole':
      return 'Team scoring: per hole only';
    case 'per_round':
      return `Team scoring: per round — ${pts.round ?? 0} pts`;
    case 'per_hole_and_round':
      return `Team scoring: per hole + per round — ${pts.round ?? 0} pts`;
    case 'fbo':
      return `Team scoring: Front/Back/Overall — ${pts.front ?? 0} / ${pts.back ?? 0} / ${pts.overall ?? 0}`;
    default:
      return null;
  }
};


const TournamentAdminDashboard: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const {
    tournament, teams, players, rounds, games, scoreboards, groups, groupPlayers, isLoading,
    updateTournament, deleteTournament, updateTeam, updatePlayer, addPlayer, removePlayer,
    startRound, completeRound, updateRound, updateGame, addRound, deleteRound,
    addScoreboard, updateScoreboard, deleteScoreboard,
    addTeam, deleteTeam, addGroup, deleteGroup,
    roundMatches, addRoundMatch, deleteRoundMatch,
  } = useTournamentDetail(tournamentId);

  const [activeTab, setActiveTab] = useState('overview');
  const [deletingTournament, setDeletingTournament] = useState(false);
  
  const [roundToDelete, setRoundToDelete] = useState<string | null>(null);
  const [pairingsRoundId, setPairingsRoundId] = useState<string | null>(null);
  const [testRound, setTestRound] = useState<any | null>(null);

  /* ── edit basic info state ── */
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', start_date: '', end_date: '', status: 'setup' });

  const openEditSheet = () => {
    if (!tournament) return;
    setEditForm({
      name: tournament.name || '',
      description: tournament.description || '',
      start_date: tournament.start_date || '',
      end_date: tournament.end_date || '',
      status: tournament.status || 'setup',
    });
    setEditOpen(true);
  };
  const saveBasicInfo = async () => {
    await updateTournament({
      name: editForm.name,
      description: editForm.description || null,
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || null,
      status: editForm.status,
    });
    setEditOpen(false);
  };

  /* ── edit round state ── */
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [roundConfigDraft, setRoundConfigDraft] = useState<RoundConfigData | null>(null);
  const [savingRound, setSavingRound] = useState(false);
  const [expandedScoreRoundId, setExpandedScoreRoundId] = useState<string | null>(null);

  const startEditRound = async (roundId: string) => {
    const round = rounds.find((r: any) => r.id === roundId);
    const game = games.find((g: any) => g.tournament_round_id === roundId);
    if (!round) return;
    setRoundConfigDraft(dbToRoundConfig(round, game));
    setEditingRoundId(roundId);
    if (game?.id) {
      const { data: holePoints } = await supabase
        .from('tournament_hole_points')
        .select('hole_number, points')
        .eq('tournament_game_id', game.id);
      if (holePoints && holePoints.length > 0) {
        setRoundConfigDraft(dbToRoundConfig(round, game, holePoints));
      }
    }
  };

  const GAME_TYPE_PLAYER_COUNT: Record<string, number> = {
    match_play_individual: 2,
    match_play_best_ball: 4,
    match_play_gross_best_ball: 4,
    blind_gross_best_ball: 4,
    scramble_2: 2,
    scramble_4: 4,
    alternate_shot_twosomes: 2,
    alternate_shot_foursomes: 4,
    tournament_sixes: 4,
  };

  const saveRoundEdits = async () => {
    if (!editingRoundId || !roundConfigDraft) return;
    setSavingRound(true);
    const game = games.find((g: any) => g.tournament_round_id === editingRoundId);
    const d = roundConfigDraft;

    await updateRound(editingRoundId, {
      name: d.name,
      round_date: d.roundDate || null,
      course_data: d.courseData || {},
      notes: d.notes || null,
      team_scoring_mode: d.teamScoringMode,
      team_scoring_points: d.teamScoringPoints,
    });


    if (game) {
      const oldPlayerCount = GAME_TYPE_PLAYER_COUNT[game.game_type] || 4;
      const newPlayerCount = GAME_TYPE_PLAYER_COUNT[d.gameType] || 4;

      await updateGame(game.id, {
        game_type: d.gameType,
        default_points_per_hole: d.defaultPointsPerHole,
        halved_hole_rule: d.halvedHoleRule,
        use_handicaps: d.useHandicaps,
        handicap_allowance_percent: d.handicapAllowancePercent,
        max_score_per_hole: d.maxScoreEnabled ? d.maxScorePerHole : null,
        second_ball_tiebreaker: d.secondBallTiebreaker,
        sixes_config: d.sixesConfig,
        sixes_format: d.sixesFormat,
        sixes_segment_points: d.sixesSegmentPoints,
      });

      // Round-trip hole point overrides: clear then re-insert only the customised holes
      await supabase.from('tournament_hole_points').delete().eq('tournament_game_id', game.id);
      if (d.holePointsCustomized) {
        const rows = d.holePointOverrides
          .map((points, i) => ({ tournament_game_id: game.id, hole_number: i + 1, points }))
          .filter(r => r.points !== d.defaultPointsPerHole);
        if (rows.length > 0) {
          await supabase.from('tournament_hole_points').insert(rows);
        }
      }

      // Clear stale pairings if game type changed to a different player count
      if (game.game_type !== d.gameType && oldPlayerCount !== newPlayerCount) {
        const { data: groups } = await supabase
          .from('tournament_groups')
          .select('id')
          .eq('tournament_round_id', editingRoundId);

        const groupIds = (groups || []).map(g => g.id);
        if (groupIds.length > 0) {
          await supabase.from('tournament_group_players').delete().in('tournament_group_id', groupIds);
          await supabase.from('tournament_groups').delete().eq('tournament_round_id', editingRoundId);
          toast.warning('Pairings cleared — new game format requires different group sizes');
        }
      }
    }

    toast.success('Round updated');
    setEditingRoundId(null);
    setRoundConfigDraft(null);
    setSavingRound(false);
  };

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  // Auto-promote tournament to active if any round is already active
  useEffect(() => {
    if (!tournament || isLoading) return;
    if (tournament.status === 'setup' && rounds.some((r: any) => r.status === 'active')) {
      updateTournament({ status: 'active' });
    }
  }, [tournament?.id, tournament?.status, rounds, isLoading]);

  if (adminLoading || (isLoading && !tournament)) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!tournament) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(tournament.join_code);
    toast.success('Copied!');
  };

  const dateRange = tournament.start_date && tournament.end_date
    ? `${format(new Date(tournament.start_date), 'MMM d')} – ${format(new Date(tournament.end_date), 'MMM d, yyyy')}`
    : '';

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tournament-admin')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={openEditSheet}><Pencil className="w-4 h-4" /></Button>
        <Badge className={statusColors[tournament.status] || ''}>
          {tournament.status === 'active' && <span className="w-2 h-2 rounded-full bg-success animate-pulse mr-1.5 inline-block" />}
          {tournament.status}
        </Badge>
      </div>

      {/* Edit Basic Info Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Tournament</SheetTitle>
            <SheetDescription>Update tournament details</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setup">Setup</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveBasicInfo}><Save className="w-4 h-4 mr-2" /> Save Changes</Button>

            <div className="border-t border-destructive/20 pt-4 mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={deletingTournament}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Tournament
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{tournament.name}" and all its rounds, scores, teams, and players. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        setDeletingTournament(true);
                        const result = await deleteTournament();
                        if (result.success) navigate('/tournament-admin');
                        setDeletingTournament(false);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

          </div>
        </SheetContent>
      </Sheet>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-lg mx-auto">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Join Code</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold tracking-wider">{tournament.join_code}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Scoring Method</p>
            <p className="text-sm font-medium">
              {tournament.team_scoring_method === 'cumulative'
                ? 'Cumulative Points — every hole counts'
                : 'Round Win — 1pt per round win, ½pt tie'}
            </p>
          </Card>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Rounds</h3>
            {rounds.map((r: any) => {
              const game = games.find((g: any) => g.tournament_round_id === r.id);
              const roundGroups = groups.filter((g: any) => g.tournament_round_id === r.id);
              const submittedCount = roundGroups.filter((g: any) => g.status === 'submitted').length;
              const pairingCount = roundGroups.length;
              return (
                <Card key={r.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.name || `Round ${r.round_number}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {game?.game_type?.replace(/_/g, ' ') || 'No game'}
                        {roundGroups.length > 0 && ` • ${submittedCount}/${roundGroups.length} groups`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={roundStatusColors[r.status] || ''}>{r.status}</Badge>
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => startRound(r.id)}>
                          <Play className="w-3.5 h-3.5 mr-1" /> Start
                        </Button>
                      )}
                      {r.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => completeRound(r.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setPairingsRoundId(r.id)}
                  >
                    <Users className="w-3.5 h-3.5 mr-1" />
                    Set Pairings{pairingCount > 0 ? ` (${pairingCount} groups)` : ''}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setTestRound(r)}
                  >
                    <FlaskConical className="w-3.5 h-3.5 mr-1" />
                    Test Start
                  </Button>
                </Card>
              );
            })}
          </div>

          {groups.filter((g: any) => g.status === 'active').length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Live Activity</h3>
              {groups.filter((g: any) => g.status === 'active').map((g: any) => (
                <Card key={g.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Group {g.group_number}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const round = rounds.find((r: any) => r.id === g.tournament_round_id);
                        if (round) navigate(`/tournament-admin/${tournamentId}/round/${round.id}/group/${g.id}`);
                      }}>
                        Scorecard
                      </Button>
                      <Button size="sm" variant="default" onClick={() => {
                        const round = rounds.find((r: any) => r.id === g.tournament_round_id);
                        if (round) navigate(`/tournament-admin/${tournamentId}/round/${round.id}/group/${g.id}/live`);
                      }}>
                        View Live
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Scoreboards</h3>
              <Button size="sm" variant="outline" onClick={() => navigate(`/tournament-admin/${tournamentId}/scoreboards`)}>
                Manage
              </Button>
            </div>
            {scoreboards.length === 0 && <p className="text-xs text-muted-foreground">No scoreboards configured yet</p>}
          </div>
        </TabsContent>

        {/* ─── Rounds Tab ─── */}
        <TabsContent value="rounds" className="space-y-3 mt-4">
          {rounds.map((r: any) => {
            const game = games.find((g: any) => g.tournament_round_id === r.id);
            const isEditing = editingRoundId === r.id;

            return (
              <Card key={r.id} className="p-4 space-y-2">
                {isEditing && roundConfigDraft ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Editing {r.name || `Round ${r.round_number}`}</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingRoundId(null); setRoundConfigDraft(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={saveRoundEdits} disabled={savingRound}>
                          <Save className="w-4 h-4 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                    <RoundConfigCard
                      data={roundConfigDraft}
                      onChange={setRoundConfigDraft}
                      roundNumber={r.round_number}
                      showTeamScoring={tournament?.team_scoring_method === 'custom_pts_per_round'}
                    />

                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{r.name || `Round ${r.round_number}`}</h3>
                      <div className="flex items-center gap-2">
                        <Badge className={roundStatusColors[r.status] || ''}>{r.status}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => startEditRound(r.id)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog open={roundToDelete === r.id} onOpenChange={open => !open && setRoundToDelete(null)}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRoundToDelete(r.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {r.name || `Round ${r.round_number}`}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this round and all its groups, scores, and results.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => { await deleteRound(r.id); setRoundToDelete(null); }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {r.round_date && <p className="text-xs text-muted-foreground">{format(new Date(r.round_date), 'MMM d, yyyy')}</p>}
                    {game && (
                      <p className="text-xs text-muted-foreground">
                        {game.game_type?.replace(/_/g, ' ')}
                        {(tournament?.team_scoring_method !== 'custom_pts_per_round' ||
                          !r.team_scoring_mode ||
                          r.team_scoring_mode === 'per_hole' ||
                          r.team_scoring_mode === 'per_hole_and_round') && <> • {game.default_points_per_hole} pts/hole</>}
                      </p>
                    )}
                    {game?.game_type === 'tournament_sixes' && (
                      <p className="text-xs text-muted-foreground">
                        Sixes: {game.sixes_format === 'sum_of_strokes' ? 'Sum of Strokes' : 'Match Play'}
                        {game.sixes_format === 'sum_of_strokes' &&
                          ` · ${(game.sixes_segment_points as any[] | null)?.join('/') ?? '1/1/1'} pts`}
                      </p>
                    )}
                    {tournament?.team_scoring_method === 'custom_pts_per_round' && teamScoringSummary(r) && (
                      <p className="text-xs text-[hsl(var(--brand-gold))]">{teamScoringSummary(r)}</p>
                    )}
                    {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}

                    {r.status === 'active' && (
                      <div className="bg-[hsl(var(--brand-gold))]/10 rounded-lg p-2 text-xs text-[hsl(var(--brand-gold))]">
                        ⚠️ This round is active. Changes apply immediately.
                      </div>
                    )}
                    {(r.status === 'completed' || r.status === 'active') && (() => {
                      const roundGroups = groups.filter((g: any) => g.tournament_round_id === r.id);
                      if (roundGroups.length === 0) return null;
                      return (
                        <div className="pt-2 border-t border-border">
                          <button
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            onClick={() => setExpandedScoreRoundId(prev => prev === r.id ? null : r.id)}
                          >
                            {expandedScoreRoundId === r.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            Edit Scores ({roundGroups.length} group{roundGroups.length !== 1 ? 's' : ''})
                          </button>
                          {expandedScoreRoundId === r.id && (
                            <div className="mt-2 space-y-2">
                              {roundGroups.map((g: any) => {
                                const gPlayers = groupPlayers
                                  .filter((gp: any) => gp.tournament_group_id === g.id)
                                  .map((gp: any) => {
                                    const p = players.find((pl: any) => pl.id === gp.tournament_player_id);
                                    return p?.display_name || 'Unknown';
                                  });
                                return (
                                  <div key={g.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                                    <div>
                                      <span className="text-sm font-medium">Group {g.group_number}</span>
                                      <p className="text-xs text-muted-foreground">{gPlayers.join(', ')}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${r.id}/group/${g.id}`)}
                                    >
                                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </Card>
            );
          })}
          <Button variant="outline" className="w-full" onClick={() => addRound(rounds.length + 1)}>
            <Plus className="w-4 h-4 mr-2" /> Add Round
          </Button>
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          <PlayerListAdmin
            players={players}
            teams={teams}
            onUpdatePlayer={updatePlayer}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
          />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <TeamListAdmin
            teams={teams}
            players={players}
            onUpdateTeam={updateTeam}
            onUpdatePlayer={updatePlayer}
            onAddTeam={addTeam}
            onDeleteTeam={deleteTeam}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <RoundResultsDashboard
            tournament={tournament}
            teams={teams}
            players={players}
            rounds={rounds}
            games={games}
            groups={groups}
            groupPlayers={groupPlayers}
          />
        </TabsContent>
      </Tabs>

      {/* Pairings Editor */}
      {pairingsRoundId && (
        <RoundPairingsEditor
          open={!!pairingsRoundId}
          onOpenChange={open => { if (!open) setPairingsRoundId(null); }}
          roundId={pairingsRoundId}
          roundName={rounds.find((r: any) => r.id === pairingsRoundId)?.name || `Round ${rounds.find((r: any) => r.id === pairingsRoundId)?.round_number}`}
          players={players}
          teams={teams}
          groups={groups}
          groupPlayers={groupPlayers}
          gameType={games.find((g: any) => g.tournament_round_id === pairingsRoundId)?.game_type}
          onAddGroup={addGroup}
          onDeleteGroup={deleteGroup}
          roundMatches={roundMatches}
          onAddMatch={addRoundMatch}
          onDeleteMatch={deleteRoundMatch}
        />
      )}
    </div>
  );
};

export default TournamentAdminDashboard;
