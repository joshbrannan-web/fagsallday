import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin } from 'lucide-react';

interface Round {
  id: string;
  round_number: number;
  name: string | null;
  course_data: any;
  round_date: string | null;
  status: string;
  notes: string | null;
}

interface Props {
  round: Round;
  gameType?: string;
  rulesText?: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  secondBallTiebreaker?: boolean;
}

const statusBadge = (status: string) => {
  if (status === 'active') return <Badge className="bg-success text-success-foreground animate-pulse-subtle">In Progress</Badge>;
  if (status === 'completed') return <Badge variant="secondary">Complete</Badge>;
  return <Badge variant="outline">Not Started</Badge>;
};

const GAME_TYPE_LABELS: Record<string, string> = {
  match_play_individual: 'Match Play 1v1',
  match_play_best_ball: 'Best Ball 2v2',
  match_play_gross_best_ball: 'Gross Best Ball',
  blind_gross_best_ball: 'Blind Gross Best Ball',
  scramble_2: 'Scramble (2)',
  scramble_4: 'Scramble (4)',
  alternate_shot_twosomes: 'Alternate Shot (2)',
  alternate_shot_foursomes: 'Alternate Shot (4)',
  tournament_sixes: 'Tournament Sixes',
};

const TournamentRoundCard: React.FC<Props> = ({ round, gameType, rulesText, isSelected, onSelect, disabled, secondBallTiebreaker }) => {
  const course = round.course_data as any;
  const courseName = course?.name || 'TBD';

  return (
    <Card
      className={`transition-all ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'ring-2 ring-primary border-primary' : disabled ? '' : 'hover:border-primary/50'}`}
      onClick={disabled ? undefined : onSelect}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Round {round.round_number}{round.name ? ` — ${round.name}` : ''}
          </h3>
          {statusBadge(round.status)}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {round.round_date && (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(round.round_date).toLocaleDateString()}</span>
          )}
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{courseName}</span>
        </div>
        {gameType && (
          <p className="text-sm font-medium text-[hsl(var(--brand-gold))]">
            {GAME_TYPE_LABELS[gameType] || gameType}
          </p>
        )}
        {rulesText && (
          <p className="text-xs text-muted-foreground line-clamp-2">{rulesText}</p>
        )}
      </CardContent>
    </Card>
  );
};

export { GAME_TYPE_LABELS };
export default TournamentRoundCard;
