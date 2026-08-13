import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import RoundConfigCard, { RoundConfigData } from './RoundConfigCard';

interface Props {
  rounds: RoundConfigData[];
  onChange: (rounds: RoundConfigData[]) => void;
  showTeamScoring?: boolean;
}

const WizardStepRounds: React.FC<Props> = ({ rounds, onChange, showTeamScoring }) => {
  const [openIdx, setOpenIdx] = useState<number>(0);

  const updateRound = (idx: number, data: RoundConfigData) => {
    const next = [...rounds];
    next[idx] = data;
    onChange(next);
  };

  const isComplete = (r: RoundConfigData) => r.name.trim() !== '' && r.gameType !== '';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Set up each round — you can edit these anytime during the tournament</p>
      {rounds.map((round, idx) => (
        <Collapsible key={idx} open={openIdx === idx} onOpenChange={open => setOpenIdx(open ? idx : -1)}>
          <CollapsibleTrigger className="w-full flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <span className="font-medium text-sm">{round.name || `Round ${idx + 1}`}</span>
            <span className="flex items-center gap-2">
              {isComplete(round)
                ? <CheckCircle2 className="w-4 h-4 text-success" />
                : <AlertCircle className="w-4 h-4 text-destructive" />
              }
              <ChevronDown className={`w-4 h-4 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <RoundConfigCard data={round} onChange={d => updateRound(idx, d)} roundNumber={idx + 1} showTeamScoring={showTeamScoring} />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};

export default WizardStepRounds;
