import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { ArrowLeft, Calendar, MapPin, History, Trash2, PlayCircle, Lock, Star } from 'lucide-react';
import { calculateRoundTotals, formatMoney } from '../services/gameEngine';

const RoundCard: React.FC<{
  round: any;
  onView: (round: any) => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
  onToggleFavorite?: (e: React.MouseEvent, id: string) => void;
}> = ({ round, onView, onDelete, onToggleFavorite }) => {
  const totals = calculateRoundTotals(round);
  let maxWin = -Infinity;
  let winnerName = '';
  Object.entries(totals).forEach(([pid, amount]) => {
    if (amount > maxWin) {
      maxWin = amount;
      winnerName = round.players.find((p: any) => p.id === pid)?.name || '';
    }
  });

  const isActive = round.status === 'ACTIVE';
  const isLocked = round.status === 'LOCKED';
  const isFavorite = round.isFavorite;

  return (
    <div
      className={`relative w-full bg-card rounded-xl shadow-sm border overflow-hidden ${
        isActive ? 'border-primary ring-1 ring-primary' : 'border-border'
      }`}
    >
      <div
        onClick={() => onView(round)}
        className="p-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
      >
        <div className="flex justify-between items-start mb-3 pr-12">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              {round.course.name}
              {isActive && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" /> LIVE
                </span>
              )}
              {isLocked && (
                <span className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> LOCKED
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" /> {round.course.location || 'Unknown location'}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(round.startTime).toLocaleDateString()}
          </div>
          {maxWin > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Winner: </span>
              <span className="font-semibold text-success">{winnerName} ({formatMoney(maxWin)})</span>
            </div>
          )}
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {round.players.map((p: any) => p.name).join(', ')}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-1">
        {onToggleFavorite && (
          <button
            onClick={(e) => onToggleFavorite(e, round.id)}
            className={`p-2 rounded-full transition-colors ${
              isFavorite 
                ? 'text-brand-gold hover:bg-brand-gold/10' 
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-brand-gold' : ''}`} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => onDelete(e, round.id)}
            className="p-2 text-destructive hover:bg-destructive/10 rounded-full"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const RoundHistory: React.FC = () => {
  const { roundHistory, loadPastRound, deleteRound, toggleRoundFavorite } = useApp();
  const navigate = useNavigate();

  const handleViewRound = (round: any) => {
    loadPastRound(round);
    if (round.status === 'ACTIVE') {
      navigate('/active');
    } else {
      navigate('/summary');
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Delete this round permanently?")) {
      deleteRound(id);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRoundFavorite(id);
  };

  // Take the 3 most recent rounds regardless of status
  const allSorted = [...roundHistory].sort((a, b) => b.startTime - a.startTime);
  const recentIds = new Set(allSorted.slice(0, 3).map(r => r.id));

  // Recent = ACTIVE, COMPLETE, or any round in the top 3 most recent
  const recentRounds = roundHistory
    .filter(r => r.status === 'ACTIVE' || r.status === 'COMPLETE' || recentIds.has(r.id))
    .sort((a, b) => b.startTime - a.startTime);

  // Completed = LOCKED rounds that are NOT in the recent section
  const completedRounds = roundHistory
    .filter(r => r.status === 'LOCKED' && !recentIds.has(r.id))
    .sort((a, b) => b.startTime - a.startTime);

  // Favorites section
  const favoriteRounds = roundHistory
    .filter(r => r.isFavorite)
    .sort((a, b) => b.startTime - a.startTime);

  const hasNoRounds = roundHistory.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-muted rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Past Rounds</h1>
      </div>

      <div className="p-4 space-y-6">
        {hasNoRounds ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="bg-muted/50 p-6 rounded-full mb-4">
              <History className="w-12 h-12 opacity-50" />
            </div>
            <p className="font-semibold">No rounds saved yet.</p>
            <p className="text-sm">Finish a round to see it here.</p>
          </div>
        ) : (
          <>
            {favoriteRounds.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" /> Favorites
                </h2>
                {favoriteRounds.map(round => (
                  <RoundCard
                    key={`fav-${round.id}`}
                    round={round}
                    onView={handleViewRound}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}

            {recentRounds.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Rounds</h2>
                {recentRounds.map(round => (
                  <RoundCard
                    key={round.id}
                    round={round}
                    onView={handleViewRound}
                    onDelete={round.status !== 'LOCKED' ? handleDelete : undefined}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}

            {completedRounds.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Completed Rounds</h2>
                {completedRounds.map(round => (
                  <RoundCard
                    key={round.id}
                    round={round}
                    onView={handleViewRound}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RoundHistory;
