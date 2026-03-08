import React from "react";

interface ScoreboardConfig {
  id: string;
  name: string;
  scoreboard_type: string;
  display_order: number | null;
}

interface Props {
  scoreboards: ScoreboardConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const ScoreboardSelector: React.FC<Props> = ({ scoreboards, selectedId, onSelect }) => {
  if (scoreboards.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {scoreboards.map((sb) => (
        <button
          key={sb.id}
          onClick={() => onSelect(sb.id)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
            selectedId === sb.id
              ? "border-[hsl(var(--brand-gold))] bg-[hsl(var(--brand-gold))]/10 text-[hsl(var(--brand-gold))]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {sb.name}
        </button>
      ))}
    </div>
  );
};

export default ScoreboardSelector;
