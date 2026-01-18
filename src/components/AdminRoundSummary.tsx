import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminRound } from '@/contexts/AdminRoundContext';
import { formatMoney } from '../services/gameEngine';
import { Home, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminRoundSummary: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useAdminRound();

  if (!currentRound) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Round Data</h2>
        <Button onClick={() => navigate('/admin')}>
          <Home className="w-5 h-5 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const sortedPlayers = [...currentRound.players].sort((a, b) => 
    (roundTotals[b.id] || 0) - (roundTotals[a.id] || 0)
  );

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

  return (
    <div className="flex flex-col p-4 space-y-6">
      {/* Leaderboard */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-brand-gold" />
          Leaderboard
        </h2>
        {sortedPlayers.map((player, idx) => {
          const amount = roundTotals[player.id] || 0;
          const isWinner = idx === 0 && amount > 0;
          const totalScore = getPlayerTotalScore(player.id);

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
                <div>
                  <span className="font-semibold">{player.name}</span>
                  <p className="text-xs text-muted-foreground">{totalScore} strokes</p>
                </div>
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

      {/* Games Played */}
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

      {/* Round Status */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Round Info</h2>
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Status</span>
            <span className={`font-semibold ${currentRound.status === 'COMPLETE' ? 'text-success' : 'text-amber-500'}`}>
              {currentRound.status}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Course</span>
            <span className="text-muted-foreground">{currentRound.course.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Players</span>
            <span className="text-muted-foreground">{currentRound.players.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Holes Played</span>
            <span className="text-muted-foreground">
              {Object.keys(currentRound.scores).length} / {currentRound.course.holes.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRoundSummary;
