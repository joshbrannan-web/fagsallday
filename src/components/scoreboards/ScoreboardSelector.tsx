import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';

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
    <Select value={selectedId} onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {scoreboards.map(sb => (
          <SelectItem key={sb.id} value={sb.id}>{sb.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ScoreboardSelector;
