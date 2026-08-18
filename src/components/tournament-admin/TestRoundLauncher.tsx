import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, RotateCcw, Users, Swords, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  fetchRoundMirrorPreview, fetchTestGroups, resetTestRound, startTestRound,
} from '@/services/testRounds';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  tournamentId: string;
  round: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GAME_LABELS: Record<string, string> = {
  match_play_individual: 'Match Play (Individual)',
  match_play_best_ball: 'Best Ball Match Play',
  match_play_gross_best_ball: 'Gross Best Ball (6/6/6)',
  blind_gross_best_ball: 'Blind Gross Best Ball',
  scramble_2: '2-Man Scramble',
  scramble_4: '4-Man Scramble',
  alternate_shot_twosomes: 'Alternate Shot (Twosomes)',
  alternate_shot_foursomes: 'Alternate Shot (Foursomes)',
  tournament_sixes: 'Sixes',
  two_man_score: 'Two Man Score',
};

const TestRoundLauncher: React.FC<Props> = ({ tournamentId, round, open, onOpenChange }) => {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<any>(null);
  const [players, setPlayers] = useState<Record<string, string>>({});
  const [existingTests, setExistingTests] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const load = async () => {
    if (!round) return;
    setIsLoading(true);
    const [p, tests] = await Promise.all([
      fetchRoundMirrorPreview(round.id),
      fetchTestGroups(round.id),
    ]);
    setPreview(p);
    setExistingTests(tests.length);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open && round) {
      load();
      import('@/integrations/supabase/client').then(async ({ supabase }) => {
        const { data } = await supabase
          .from('tournament_players')
          .select('id, display_name')
          .eq('tournament_id', tournamentId);
        const map: Record<string, string> = {};
        (data || []).forEach(p => { map[p.id] = p.display_name; });
        setPlayers(map);
      });
    }
  }, [open, round?.id]);

  const nameOf = (id: string) => players[id] || 'Player';

  const handleStart = async () => {
    if (!round) return;
    setIsStarting(true);
    try {
      const groups = await startTestRound(round.id);
      toast.success(`Test round started 🧪 — ${groups.length} group${groups.length > 1 ? 's' : ''} mirrored`);
      onOpenChange(false);
      navigate(`/tournament-admin/${tournamentId}/test/${round.id}`);
    } catch (e: any) {
      if (e?.message === 'NO_PAIRINGS') {
        toast.error('Set pairings for this round first — the test mirrors them.');
      } else {
        console.error(e);
        toast.error('Failed to start test round');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleReset = async () => {
    if (!round) return;
    setIsResetting(true);
    try {
      const n = await resetTestRound(round.id);
      setExistingTests(0);
      toast.success(n > 0 ? 'Test data cleared' : 'No test data to clear');
    } catch {
      toast.error('Failed to reset test data');
    } finally {
      setIsResetting(false);
    }
  };

  const groups = preview?.groups || [];
  const matches = preview?.matches || [];
  const hasPairings = groups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
            Test Start — {round?.name || `Round ${round?.round_number}`}
          </DialogTitle>
          <DialogDescription>
            Runs a full practice copy of this round — same game, same pairings, same matches — with
            fake scores. Nothing touches scoreboards or standings, and you can reset any time.
          </DialogDescription>
        </DialogHeader>

        {existingTests > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--brand-gold))]/50 bg-[hsl(var(--brand-gold))]/10 p-3">
            <p className="text-sm">A test is already running ({existingTests} group{existingTests > 1 ? 's' : ''})</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { onOpenChange(false); navigate(`/tournament-admin/${tournamentId}/test/${round.id}`); }}>
                Open
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset} disabled={isResetting}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading round setup…</p>
        ) : !hasPairings ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <p className="text-sm">
              This round has no pairings yet. Use <strong>Set Pairings</strong> to build the groups
              (and any cross-group matches) — the test mirrors exactly what's there.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Game</p>
              <p className="text-sm font-medium">
                {GAME_LABELS[preview?.gameType] || preview?.gameType || 'Not configured'}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Users className="w-3.5 h-3.5" /> Groups ({groups.length})
              </p>
              {groups.map((g: any) => {
                const names = (preview?.groupPlayers || [])
                  .filter((gp: any) => gp.tournament_group_id === g.id)
                  .map((gp: any) => nameOf(gp.tournament_player_id));
                return (
                  <div key={g.id} className="flex items-start justify-between gap-2 text-sm">
                    <Badge variant="outline" className="text-xs shrink-0">G{g.group_number}</Badge>
                    <span className="flex-1 text-right text-muted-foreground">
                      {names.join(' • ') || 'No players'}
                    </span>
                  </div>
                );
              })}
            </div>

            {matches.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Swords className="w-3.5 h-3.5" /> Cross-group matches ({matches.length})
                </p>
                {matches.map((m: any) => (
                  <p key={m.id} className="text-sm text-muted-foreground">
                    M{m.match_number}: {(m.side_a || []).map(nameOf).join(' & ')} vs{' '}
                    {(m.side_b || []).map(nameOf).join(' & ')}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full" disabled={!hasPairings || isStarting || isLoading}>
              <FlaskConical className="w-4 h-4 mr-1" />
              {isStarting ? 'Starting…' : existingTests > 0 ? 'Restart Test Round' : 'Start Test Round'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start a test of this round?</AlertDialogTitle>
              <AlertDialogDescription>
                A test copy of every group and match will be created. Any existing test data for
                this round is cleared first. Real tournament data is untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStart}>Start Test</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default TestRoundLauncher;
