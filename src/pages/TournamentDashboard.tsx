import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, Copy, Loader2, Crown, Plus, Play, CheckCircle, Lock, Unlock, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TournamentDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tournament,
    players,
    rounds,
    isLoading,
    isCreator,
    myRole,
    updateTournamentStatus,
    removePlayer,
    deleteTournament,
    lockTournament,
    unlockTournament,
  } = useTournament(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <p className="text-muted-foreground mb-4">Tournament not found</p>
        <Button onClick={() => navigate('/tournament')}>Back to Tournaments</Button>
      </div>
    );
  }

  const copyJoinCode = () => {
    const url = `${window.location.origin}${window.location.pathname}#/tournament/join?code=${tournament.join_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Join link copied!');
  };

  const handleDelete = async () => {
    const success = await deleteTournament(tournament.id);
    if (success) navigate('/tournament');
  };

  const handleLock = () => {
    if (window.confirm('Lock this tournament? This marks it as complete and prevents further changes.')) {
      lockTournament();
    }
  };

  const isLocked = tournament.status === 'COMPLETE';

  // Calculate leaderboard
  const leaderboard = players
    .filter(p => p.role !== 'super_user' || players.length <= 1)
    .map(player => {
      let totalPoints = 0;
      let totalStrokes = 0;
      rounds.forEach(round => {
        const pts = (round.points_data as any)?.[player.id];
        if (typeof pts === 'number') totalPoints += pts;
        const scores = round.scores as Record<string, Record<string, number>>;
        Object.values(scores).forEach(holeScores => {
          const s = holeScores[player.id];
          if (typeof s === 'number') totalStrokes += s;
        });
      });
      return { ...player, totalPoints, totalStrokes };
    })
    .sort((a, b) =>
      tournament.scoring_mode === 'points'
        ? b.totalPoints - a.totalPoints
        : a.totalStrokes - b.totalStrokes
    );

  const statusColor = {
    SETUP: 'text-muted-foreground',
    ACTIVE: 'text-success',
    COMPLETE: 'text-primary',
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tournament')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate flex items-center gap-1.5">
            {tournament.name}
            {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
          </h1>
          <p className={`text-sm capitalize ${statusColor[tournament.status]}`}>
            {tournament.status.toLowerCase()} • {tournament.scoring_mode.replace('_', ' ')}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={copyJoinCode}>
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Join Code Banner */}
      <div className="bg-accent rounded-lg p-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-accent-foreground/70">Join Code</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-accent-foreground">
            {tournament.join_code}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={copyJoinCode} className="gap-1">
          <Copy className="w-4 h-4" />
          Copy Link
        </Button>
      </div>

      {/* Creator Controls */}
      {isCreator && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tournament.status === 'SETUP' && (
            <Button size="sm" onClick={() => updateTournamentStatus('ACTIVE')} className="gap-1">
              <Play className="w-4 h-4" />
              Start Tournament
            </Button>
          )}
          {tournament.status === 'ACTIVE' && (
            <>
              <Button size="sm" onClick={() => navigate(`/tournament/${id}/setup-round`)} className="gap-1">
                <Plus className="w-4 h-4" />
                Add Round
              </Button>
              <Button size="sm" variant="outline" onClick={handleLock} className="gap-1">
                <Lock className="w-4 h-4" />
                Lock
              </Button>
            </>
          )}
          {isLocked && (
            <Button size="sm" variant="outline" onClick={() => unlockTournament()} className="gap-1">
              <Unlock className="w-4 h-4" />
              Unlock
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{tournament.name}" and all its rounds and players. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <Tabs defaultValue="leaderboard">
        <TabsList className="w-full">
          <TabsTrigger value="leaderboard" className="flex-1">Leaderboard</TabsTrigger>
          <TabsTrigger value="rounds" className="flex-1">Rounds ({rounds.length})</TabsTrigger>
          <TabsTrigger value="players" className="flex-1">Players ({players.length})</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          {leaderboard.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No players yet</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((p, i) => (
                <div key={p.id} className="bg-card border rounded-lg p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    i === 0 ? 'bg-brand-gold text-brand-dark' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate flex items-center gap-1">
                      {p.player_name}
                      {p.role === 'super_user' && <Crown className="w-3 h-3 text-brand-gold" />}
                    </p>
                    <p className="text-xs text-muted-foreground">HCP: {p.handicap_index}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-foreground">
                      {tournament.scoring_mode === 'points' ? p.totalPoints : p.totalStrokes}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tournament.scoring_mode === 'points' ? 'pts' : 'strokes'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rounds */}
        <TabsContent value="rounds" className="mt-4">
          {rounds.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {isCreator ? 'Add a round to get started' : 'No rounds yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {rounds.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/tournament/${id}/round/${r.id}`)}
                  className="w-full bg-card border rounded-lg p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        Round {r.round_number}
                        {(r.course_data as any)?.name && ` — ${(r.course_data as any).name}`}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">{r.status.toLowerCase()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      r.status === 'ACTIVE' ? 'bg-success/10 text-success' :
                      r.status === 'COMPLETE' ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Players */}
        <TabsContent value="players" className="mt-4">
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    {p.player_name}
                    {p.role === 'super_user' && <Crown className="w-3 h-3 text-brand-gold" />}
                    {p.role === 'scorekeeper' && <span className="text-xs text-muted-foreground ml-1">(Scorekeeper)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">HCP: {p.handicap_index}</p>
                </div>
                {isCreator && p.role !== 'super_user' && !isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removePlayer(p.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentDashboard;
