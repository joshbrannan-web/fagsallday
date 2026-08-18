import React, { useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
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
  onReset?: () => void;
}

const TestRoundBanner: React.FC<Props> = ({ tournamentRoundId, onReset }) => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetTestRound(tournamentRoundId);
      toast.success('Test round reset');
      onReset?.();
      navigate('/');
    } catch {
      toast.error('Failed to reset test round');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--brand-gold))]/50 bg-[hsl(var(--brand-gold))]/10 px-3 py-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
        Test round — scores are excluded from tournament scoreboards
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={isResetting}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this test round?</AlertDialogTitle>
            <AlertDialogDescription>
              All test scores and test groups for this round will be deleted so you can run another
              test. Real tournament data is untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset Test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TestRoundBanner;
