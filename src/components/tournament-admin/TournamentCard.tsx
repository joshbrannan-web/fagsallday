import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Users, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Tournament } from '@/types/tournament';

const statusColors: Record<string, string> = {
  setup: 'bg-muted text-muted-foreground',
  active: 'bg-success/20 text-success',
  completed: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

interface TournamentCardProps {
  tournament: Tournament;
  playerCount?: number;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, playerCount }) => {
  const navigate = useNavigate();
  const copyCode = () => {
    navigator.clipboard.writeText(tournament.joinCode);
    toast.success('Join code copied!');
  };

  const dateRange = tournament.startDate && tournament.endDate
    ? `${format(new Date(tournament.startDate), 'MMM d')} – ${format(new Date(tournament.endDate), 'MMM d, yyyy')}`
    : tournament.startDate
      ? format(new Date(tournament.startDate), 'MMM d, yyyy')
      : 'No dates set';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg">{tournament.name}</h3>
          <p className="text-sm text-muted-foreground">{dateRange}</p>
        </div>
        <Badge className={statusColors[tournament.status] || ''}>
          {tournament.status === 'active' && <span className="w-2 h-2 rounded-full bg-success animate-pulse mr-1.5 inline-block" />}
          {tournament.status}
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><Flag className="w-3.5 h-3.5" /> {tournament.numRounds} rounds</span>
        {playerCount !== undefined && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {playerCount} players</span>}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={copyCode} className="flex items-center gap-1.5 text-sm font-mono bg-muted px-2 py-1 rounded">
          {tournament.joinCode} <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <Button size="sm" onClick={() => navigate(`/tournament-admin/${tournament.id}`)}>
          Open Dashboard
        </Button>
      </div>
    </Card>
  );
};

export default TournamentCard;
