import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useTournamentRoundSetup } from '@/hooks/useTournamentRoundSetup';
import { resetTestRound, fetchTestGroups } from '@/services/testRounds';
import { toast } from 'sonner';

interface Props {
  tournamentId: string;
  round: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TestRoundLauncher: React.FC<Props> = ({ tournamentId, round, open, onOpenChange }) => {
  const {
    allPlayers, teams, selectedPlayers, tournamentGame, requiredPlayerCount,
    selectRound, togglePlayer, startRound, isStarting,
  } = useTournamentRoundSetup(tournamentId);

  const [existingTests, setExistingTests] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (open && round) {
      selectRound(round);
      fetchTestGroups(round.id).then(g => setExistingTests(g.length));
    }
  }, [open, round?.id]);

  const teamName = (teamId: string | null) => teams.find(t => t.id === teamId)?.name || 'No team';

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

  const canStart = selectedPlayers.length === requiredPlayerCount && !!tournamentGame;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
            Test Start — {round?.name || `Round ${round?.round_number}`}
          </DialogTitle>
          <DialogDescription>
            Play a practice round with fake scores to verify the game and scoring. Test data never
            appears on scoreboards and can be reset at any time.
          </DialogDescription>
        </DialogHeader>

        {existingTests > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <p className="text-sm">{existingTests} existing test group{existingTests > 1 ? 's' : ''}</p>
            <Button size="sm" variant="outline" onClick={handleReset} disabled={isResetting}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Test
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Select players ({selectedPlayers.length}/{requiredPlayerCount})
          </p>
          {allPlayers.map(p => {
            const checked = selectedPlayers.some(sp => sp.id === p.id);
            return (
              <label
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5 cursor-pointer"
              >
                <Checkbox checked={checked} onCheckedChange={() => togglePlayer(p)} />
                <span className="text-sm flex-1">{p.display_name}</span>
                <Badge variant="outline" className="text-xs">{teamName(p.team_id)}</Badge>
              </label>
            );
          })}
        </div>

        <Button
          className="w-full"
          disabled={!canStart || isStarting}
          onClick={() => startRound({ test: true })}
        >
          <FlaskConical className="w-4 h-4 mr-1" />
          {isStarting ? 'Starting…' : 'Start Test Round'}
        </Button>
        {!tournamentGame && (
          <p className="text-xs text-destructive">This round has no game configured yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TestRoundLauncher;
