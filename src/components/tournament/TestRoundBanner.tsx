import React, { useState } from 'react';
import { FlaskConical, RotateCcw, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { resetTestRound } from '@/services/testRounds';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  tournamentRoundId: string;
  /** Enables the "Test Console" link back to the admin test view. */
  tournamentId?: string;
  /** Hide the console link (e.g. when already on the console). */
  hideConsoleLink?: boolean;
  onReset?: () => void;
  /** Where to go after a reset. Defaults to the test console (or home). */
  resetRedirect?: string;
}

const TestRoundBanner: React.FC<Props> = ({
  tournamentRoundId, tournamentId, hideConsoleLink, onReset, resetRedirect,
}) => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);

  const consolePath = tournamentId
    ? `/tournament-admin/${tournamentId}/test/${tournamentRoundId}`
    : null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetTestRound(tournamentRoundId);
      toast.success('Test round reset — start a new test any time');
      onReset?.();
      navigate(resetRedirect || consolePath || '/');
    } catch {
      toast.error('Failed to reset test round');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[hsl(var(--brand-gold))]/50 bg-[hsl(var(--brand-gold))]/10 px-3 py-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
        Test round — mirrors this round's setup, excluded from all scoreboards
      </p>
      <div className="flex items-center gap-2">
        {consolePath && !hideConsoleLink && (
          <Button size="sm" variant="ghost" onClick={() => navigate(consolePath)}>
            <LayoutList className="w-3.5 h-3.5 mr-1" /> Test Console
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={isResetting}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Test
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this test round?</AlertDialogTitle>
              <AlertDialogDescription>
                All test groups, test matches and test scores for this round will be deleted so you
                can run another test. Real tournament data is untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset Test</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TestRoundBanner;
