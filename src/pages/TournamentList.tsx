import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Plus, ArrowLeft, Users, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TournamentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tournaments, isLoading, createTournament, joinTournament } = useTournament();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [scoringMode, setScoringMode] = useState<'stroke_play' | 'points'>('points');
  const [maxPlayers, setMaxPlayers] = useState('20');
  const [joinCode, setJoinCode] = useState(searchParams.get('code') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth guard
  React.useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Auto-join if code in URL
  React.useEffect(() => {
    const code = searchParams.get('code');
    if (code && user) {
      handleJoin(code);
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    const t = await createTournament(name.trim(), scoringMode, parseInt(maxPlayers) || 20);
    setIsSubmitting(false);
    if (t) {
      setShowCreate(false);
      navigate(`/tournament/${t.id}`);
    }
  };

  const handleJoin = async (code?: string) => {
    const c = code || joinCode.trim();
    if (!c) return;
    setIsSubmitting(true);
    const t = await joinTournament(c);
    setIsSubmitting(false);
    if (t) navigate(`/tournament/${t.id}`);
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

      {/* Create Tournament */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <Button className="w-full mb-6 gap-2" size="lg">
            <Plus className="w-5 h-5" />
            Create Tournament
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground">Tournament Name</label>
              <Input
                placeholder="e.g. Annual Buddies Trip"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Scoring Mode</label>
              <Select value={scoringMode} onValueChange={v => setScoringMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points-Based</SelectItem>
                  <SelectItem value="stroke_play">Stroke Play</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Max Players</label>
              <Input
                type="number"
                value={maxPlayers}
                onChange={e => setMaxPlayers(e.target.value)}
                min={2}
                max={200}
              />
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tournament List */}
      {tournaments.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tournaments yet</p>
          <p className="text-sm">Create one or join with a code</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <button
              key={t.id}
              onClick={() => navigate(`/tournament/${t.id}`)}
              className="w-full bg-card border rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{t.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {t.scoring_mode.replace('_', ' ')} • {t.status.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{t.max_players}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentList;
