import React from 'react';
import { FileText } from 'lucide-react';

interface Props {
  text: string;
  title?: string;
}

const TournamentRulesCallout: React.FC<Props> = ({ text, title = 'Rules' }) => (
  <div className="border-l-4 border-yellow-500 bg-yellow-950/30 rounded-r-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <FileText className="w-4 h-4 text-[hsl(var(--brand-gold))]" />
      <span className="font-semibold text-sm text-[hsl(var(--brand-gold))]">{title}</span>
    </div>
    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{text}</p>
  </div>
);

export default TournamentRulesCallout;
