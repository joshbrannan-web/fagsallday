import React from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import TournamentMatchTracker from './TournamentMatchTracker';
import { useTournamentOverlay } from '@/hooks/useTournamentOverlay';

interface Props {
  tournamentGroupId: string;
  tournamentName?: string;
  roundName?: string;
  playerMapping?: Record<string, string>;
  teamMatchup?: { teamAId: string; teamBId: string } | null;
}

const TournamentRoundSummary: React.FC<Props> = ({
  tournamentGroupId,
  tournamentName,
  roundName,
  playerMapping,
  teamMatchup,
}) => {
  const overlay = useTournamentOverlay(tournamentGroupId, tournamentName, roundName, playerMapping, teamMatchup);

  if (overlay.isLoading) return null;

  return (
    <Card className="border-[hsl(var(--brand-gold))]/30 bg-[hsl(var(--brand-gold))]/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
          <span className="font-bold">Tournament Round Summary</span>
        </div>
        <TournamentMatchTracker
          holeResults={overlay.holeResults}
          teamMatchup={overlay.teamMatchup}
          teams={overlay.teams}
          teamTotals={overlay.teamTotals}
        />
        <p className="text-xs text-muted-foreground text-center">
          ✓ These results will be submitted to the live tournament leaderboard
        </p>
      </CardContent>
    </Card>
  );
};

export default TournamentRoundSummary;
