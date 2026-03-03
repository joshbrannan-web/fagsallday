import React, { useState } from 'react';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import TournamentMatchTracker from './TournamentMatchTracker';
import { useTournamentOverlay } from '@/hooks/useTournamentOverlay';

interface Props {
  tournamentGroupId: string;
  tournamentName?: string;
  roundName?: string;
  playerMapping?: Record<string, string>;
  teamMatchup?: { teamAId: string; teamBId: string } | null;
  activeHole?: number;
}

const TournamentGameOverlay: React.FC<Props> = ({
  tournamentGroupId,
  tournamentName,
  roundName,
  playerMapping,
  teamMatchup,
  activeHole,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const overlay = useTournamentOverlay(tournamentGroupId, tournamentName, roundName, playerMapping, teamMatchup);

  if (overlay.isLoading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-card border border-border rounded-xl overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
          <span className="font-semibold text-sm">
            {overlay.tournamentName}{overlay.roundName && ` — ${overlay.roundName}`}
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0">
        <TournamentMatchTracker
          holeResults={overlay.holeResults}
          teamMatchup={overlay.teamMatchup}
          teams={overlay.teams}
          teamTotals={overlay.teamTotals}
          activeHole={activeHole}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TournamentGameOverlay;
