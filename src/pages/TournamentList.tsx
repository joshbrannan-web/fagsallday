import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Plus, ArrowLeft, Users, Loader2, Trash2, Lock } from 'lucide-react';
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

const TournamentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tournaments, isLoading, createTournament, joinTournament, deleteTournament } = useTournament();

  const [joinCode, setJoinCode] = useState(searchParams.get('code') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  React.useEffect(() => {
    const code = searchParams.get('code');
    if (code && user) handleJoin(code);
  }, [user]);

  if (!user) return null;

  const handleJoin = async (code?: string) => {
    const c = code || joinCode.trim();
    if (!c) return;
    setIsSubmitting(true);
    const t = await joinTournament(c);
    setIsSubmitting(false);
    if (t) navigate(`/tournament/${t.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteTournament(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Trophy className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Tournaments</h1>
      </div>

      {/* Join Tournament */}
      <div className="bg-card rounded-xl p-4 mb-6 border">
        <h2 className="font-semibold mb-3 text-foreground">Join a Tournament</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Enter join code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="uppercase tracking-widest font-mono text-center text-lg"
          />
          <Button onClick={() => handleJoin()} disabled={!joinCode.trim() || isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
          </Button>
        </div>
      </div>

      <Button className="w-full mb-6 gap-2" size="lg" onClick={() => navigate('/tournament/create')}>
        <Plus className="w-5 h-5" />
        Create Tournament
      </Button>

      {tournaments.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tournaments yet</p>
          <p className="text-sm">Create one or join with a code</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <div key={t.id} className="relative">
              <button
                onClick={() => navigate(`/tournament/${t.id}`)}
                className="w-full bg-card border rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                      {t.name}
                      {t.status === 'COMPLETE' && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {t.scoring_mode.replace('_', ' ')} • {t.status.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{t.max_players}</span>
                    </div>
                    {t.creator_id === user.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={e => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={e => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{t.name}" and all its rounds and players. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={e => handleDelete(e, t.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentList;
