import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { formatMoney } from '../services/gameEngine';
import { Home, Trophy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const RoundSummary: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals, finishRound } = useApp();

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Round Data</h2>
        <Button onClick={() => navigate('/')}>
          <Home className="w-5 h-5 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const sortedPlayers = [...currentRound.players].sort((a, b) => 
    (roundTotals[b.id] || 0) - (roundTotals[a.id] || 0)
  );

  const handleFinish = () => {
    finishRound();
    toast.success('Round saved to history!');
    navigate('/');
  };

  const handleShare = async () => {
    const roundDate = new Date(currentRound.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Calculate total strokes for each player
    const getPlayerTotalScore = (playerId: string) => {
      let total = 0;
      Object.values(currentRound.scores).forEach(holeScores => {
        const score = holeScores[playerId];
        if (score !== null && score !== undefined) {
          total += score;
        }
      });
      return total;
    };

    const results = sortedPlayers.map((p) => 
      `${p.name}: ${formatMoney(roundTotals[p.id] || 0)} (${getPlayerTotalScore(p.id)} strokes)`
    ).join('\n');

    const text = `🏌️ ${currentRound.course.name} - ${roundDate}\n\n${results}\n\nMoney Shot by F&Gs All Day`;

    if (navigator.share) {
      await navigator.share({ title: 'Golf Round Results', text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Results copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand-dark text-primary-foreground p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-2 text-brand-gold" />
        <h1 className="text-2xl font-bold">Round Complete</h1>
        <p className="text-sm opacity-80">{currentRound.course.name}</p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Leaderboard</h2>
          {sortedPlayers.map((player, idx) => {
            const amount = roundTotals[player.id] || 0;
            const isWinner = idx === 0 && amount > 0;

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                  isWinner ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-brand-gold text-white' :
                    idx === 1 ? 'bg-muted-foreground/50 text-white' :
                    idx === 2 ? 'bg-brand-rust text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="font-semibold">{player.name}</span>
                </div>
                <span className={`text-xl font-bold font-mono ${
                  amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {formatMoney(amount)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Games Played</h2>
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            {currentRound.games.map(game => (
              <div key={game.id} className="flex justify-between text-sm">
                <span>{game.name}</span>
                <span className="text-muted-foreground">${game.unitStake}/unit</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-card border-t border-border space-y-3">
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="outline" onClick={() => navigate('/scorecard')} className="flex-1">
            View Scorecard
          </Button>
        </div>
        <Button onClick={handleFinish} className="w-full">
          <Home className="w-4 h-4 mr-2" /> Finish & Save
        </Button>
      </div>
    </div>
  );
};

export default RoundSummary;
