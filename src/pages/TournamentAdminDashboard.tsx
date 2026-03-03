import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { ArrowLeft, Copy, Flag, Users, Play, CheckCircle2, Pencil, Save, X, Trash2, Plus } from 'lucide-react';
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
function dbToRoundConfig(round: any, game: any): RoundConfigData {
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
    holePointOverrides: base.holePointOverrides, // TODO: merge hole_points rows
  };
}

const TournamentAdminDashboard: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const {
    tournament, teams, players, rounds, games, scoreboards, groups, isLoading,
    updateTournament, deleteTournament, updateTeam, updatePlayer, addPlayer, removePlayer,
    startRound, completeRound, updateRound, updateGame, addRound, deleteRound,
    addScoreboard, updateScoreboard, deleteScoreboard,
    addTeam, deleteTeam,
  } = useTournamentDetail(tournamentId);

  const [deletingTournament, setDeletingTournament] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<string | null>(null);

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

  const startEditRound = (roundId: string) => {
    const round = rounds.find((r: any) => r.id === roundId);
    const game = games.find((g: any) => g.tournament_round_id === roundId);
    if (!round) return;
    setRoundConfigDraft(dbToRoundConfig(round, game));
    setEditingRoundId(roundId);
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
    });

    if (game) {
      await updateGame(game.id, {
        game_type: d.gameType,
        default_points_per_hole: d.defaultPointsPerHole,
        halved_hole_rule: d.halvedHoleRule,
        use_handicaps: d.useHandicaps,
        handicap_allowance_percent: d.handicapAllowancePercent,
        max_score_per_hole: d.maxScoreEnabled ? d.maxScorePerHole : null,
        second_ball_tiebreaker: d.secondBallTiebreaker,
        sixes_config: d.sixesConfig,
      });
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

  if (adminLoading || isLoading) {
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
                        const success = await deleteTournament();
                        if (success) navigate('/tournament-admin');
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

      <Tabs defaultValue="overview" className="max-w-lg mx-auto">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
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

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Rounds</h3>
            {rounds.map((r: any) => {
              const game = games.find((g: any) => g.tournament_round_id === r.id);
              const roundGroups = groups.filter((g: any) => g.tournament_round_id === r.id);
              const submittedCount = roundGroups.filter((g: any) => g.status === 'submitted').length;
              return (
                <Card key={r.id} className="p-3 flex items-center justify-between">
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
                    <Button size="sm" variant="outline" onClick={() => {
                      const round = rounds.find((r: any) => r.id === g.tournament_round_id);
                      if (round) navigate(`/tournament-admin/${tournamentId}/round/${round.id}/group/${g.id}`);
                    }}>
                      View Scorecard
                    </Button>
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
                    {game && <p className="text-xs text-muted-foreground">{game.game_type?.replace(/_/g, ' ')} • {game.default_points_per_hole} pts/hole</p>}
                    {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
                    {r.status === 'active' && (
                      <div className="bg-[hsl(var(--brand-gold))]/10 rounded-lg p-2 text-xs text-[hsl(var(--brand-gold))]">
                        ⚠️ This round is active. Changes apply immediately.
                      </div>
                    )}
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
      </Tabs>
    </div>
  );
};

export default TournamentAdminDashboard;
