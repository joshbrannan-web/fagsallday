import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  onLookup: (code: string) => Promise<void>;
  lookupResult: any | null;
  lookupError: string | null;
  isLookingUp: boolean;
  creatorName: string | null;
  onClear: () => void;
}

const statusBadge = (status: string) => {
  if (status === 'active') return <Badge className="bg-success text-success-foreground">Active</Badge>;
  if (status === 'completed') return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">Setup</Badge>;
};

const TournamentJoinCard: React.FC<Props> = ({ onLookup, lookupResult, lookupError, isLookingUp, creatorName, onClear }) => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length > 0) onLookup(code.trim());
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-[hsl(var(--brand-gold))]" />
          <h2 className="text-lg font-bold">Enter Tournament Code</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 6)); onClear(); }}
            placeholder="ABC123"
            className="text-center font-mono text-lg tracking-widest uppercase"
            maxLength={6}
            autoFocus
          />
          <Button type="submit" disabled={isLookingUp || code.length === 0}>
            {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </form>

        {lookupError && <p className="text-sm text-destructive text-center">{lookupError}</p>}

        {lookupResult && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{lookupResult.name}</h3>
              {statusBadge(lookupResult.status)}
            </div>
            {creatorName && <p className="text-sm text-muted-foreground">Organized by {creatorName}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/tournament/${lookupResult.join_code}/scoreboards`)}>
                View Tournament
              </Button>
              <Button className="flex-1" onClick={() => navigate(`/tournament/${lookupResult.join_code}/build-round`)}>
                Build Round
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TournamentJoinCard;
