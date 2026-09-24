import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  rounds: any[];
  excluded: Set<string>;
  onToggle: (roundId: string) => void;
}

/** Chips that let the viewer choose which rounds count toward the total. */
const RoundToggleChips: React.FC<Props> = ({ rounds, excluded, onToggle }) => {
  if (rounds.length < 2) return null;
  const includedCount = rounds.filter((r) => !excluded.has(r.id)).length;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2 border-b">
      <span className="text-xs text-muted-foreground mr-1">Count rounds:</span>
      {rounds.map((r) => {
        const on = !excluded.has(r.id);
        const locked = on && includedCount === 1;
        return (
          <button
            key={r.id}
            type="button"
            disabled={locked}
            onClick={() => onToggle(r.id)}
            aria-pressed={on}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
              on
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground line-through'
            } ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {on && <Check className="w-3 h-3" />}R{r.round_number}
          </button>
        );
      })}
    </div>
  );
};

export default RoundToggleChips;
