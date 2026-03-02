import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { ArrowLeft, Copy, Flag, Users, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerListAdmin from '@/components/tournament-admin/PlayerListAdmin';
import TeamListAdmin from '@/components/tournament-admin/TeamListAdmin';
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

const TournamentAdminDashboard: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const {
    tournament, teams, players, rounds, games, scoreboards, groups, isLoading,
    updateTeam, updatePlayer, addPlayer, removePlayer,
    startRound, completeRound,
    addScoreboard, updateScoreboard, deleteScoreboard,
    addTeam, deleteTeam,
  } = useTournamentDetail(tournamentId);

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
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tournament-admin')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        </div>
        <Badge className={statusColors[tournament.status] || ''}>
          {tournament.status === 'active' && <span className="w-2 h-2 rounded-full bg-success animate-pulse mr-1.5 inline-block" />}
          {tournament.status}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="max-w-lg mx-auto">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Join Code */}
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Join Code</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold tracking-wider">{tournament.join_code}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          {/* Round Status */}
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

          {/* Active Groups */}
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

          {/* Scoreboards */}
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

        <TabsContent value="rounds" className="space-y-3 mt-4">
          {rounds.map((r: any) => {
            const game = games.find((g: any) => g.tournament_round_id === r.id);
            return (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{r.name || `Round ${r.round_number}`}</h3>
                  <Badge className={roundStatusColors[r.status] || ''}>{r.status}</Badge>
                </div>
                {r.round_date && <p className="text-xs text-muted-foreground">{format(new Date(r.round_date), 'MMM d, yyyy')}</p>}
                {game && <p className="text-xs text-muted-foreground">{game.game_type?.replace(/_/g, ' ')} • {game.default_points_per_hole} pts/hole</p>}
                {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
                {r.status === 'active' && (
                  <div className="bg-[hsl(var(--brand-gold))]/10 rounded-lg p-2 text-xs text-[hsl(var(--brand-gold))]">
                    ⚠️ This round is active. Changes apply immediately.
                  </div>
                )}
              </Card>
            );
          })}
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
