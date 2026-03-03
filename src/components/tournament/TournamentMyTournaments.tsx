import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  status: string;
  join_code: string;
  start_date: string | null;
  end_date: string | null;
}

const statusBadge = (status: string) => {
  if (status === 'active') return <Badge className="bg-success text-success-foreground animate-pulse-subtle">Active</Badge>;
  if (status === 'completed') return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">Setup</Badge>;
};

const TournamentMyTournaments: React.FC<{ tournaments: Tournament[] }> = ({ tournaments }) => {
  const navigate = useNavigate();

  if (tournaments.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-6">
        Enter a tournament code above to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">My Tournaments</h2>
      {tournaments.map(t => (
        <Card key={t.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t.name}</h3>
              {statusBadge(t.status)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {(t.start_date || t.end_date) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t.start_date && new Date(t.start_date).toLocaleDateString()}
                  {t.end_date && ` — ${new Date(t.end_date).toLocaleDateString()}`}
                </span>
              )}
              <span className="font-mono text-xs">{t.join_code}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/tournament/${t.join_code}/scoreboards`)}>
                View Tournament
              </Button>
              <Button size="sm" className="flex-1" disabled={t.status === 'completed' || t.status === 'setup'} onClick={() => navigate(`/tournament/${t.join_code}/build-round`)}>
                Build Round
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TournamentMyTournaments;
