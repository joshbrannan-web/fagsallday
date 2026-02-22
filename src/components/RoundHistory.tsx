import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ArrowLeft, Calendar, MapPin, History, Trash2, PlayCircle, Lock, Star, Search, Plus, TrendingUp, Trophy, Share2 } from 'lucide-react';
import { calculateRoundTotals, formatMoney } from '../services/gameEngine';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const isShared = round.isShared;

  // Count scored holes
  const totalHoles = round.course?.holes?.length || 18;
  const scoredHoles = Object.keys(round.scores || {}).filter(h => {
    const holeScores = round.scores[h];
    return round.players.some((p: any) => typeof holeScores?.[p.id] === 'number' && holeScores[p.id] > 0);
  }).length;

  // Get game names
  const gameNames = (round.games || []).map((g: any) => g.name);

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
        <div className="flex justify-between items-start mb-2 pr-12">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              {round.course.name}
              {isActive && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" /> LIVE
                </span>
              )}
              {isLocked && !isShared && (
                <span className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> LOCKED
                </span>
              )}
              {isShared && (
                <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Share2 className="w-3 h-3" /> SHARED
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" /> {round.course.location || 'Unknown location'}
            </div>
          </div>
        </div>

        {/* Game badges */}
        {gameNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {gameNames.map((name: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                {name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(round.startTime).toLocaleDateString()}
            </div>
            {/* Holes completed indicator */}
            {(isActive || scoredHoles < totalHoles) && scoredHoles > 0 && (
              <div className="text-xs text-muted-foreground">
                {scoredHoles}/{totalHoles} holes
              </div>
            )}
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
          {isShared && round.ownerName && (
            <span className="ml-2 text-primary">• by {round.ownerName}</span>
          )}
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(e, round.id); }}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleViewRound = (round: any) => {
    loadPastRound(round);
    if (round.status === 'ACTIVE') {
      navigate('/active');
    } else {
      navigate('/summary');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteRound(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRoundFavorite(id);
  };

  // Filter rounds by search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return roundHistory;
    const q = searchQuery.toLowerCase();
    return roundHistory.filter(r =>
      r.course.name.toLowerCase().includes(q) ||
      r.course.location?.toLowerCase().includes(q) ||
      r.players.some((p: any) => p.name.toLowerCase().includes(q))
    );
  }, [roundHistory, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (roundHistory.length === 0) return null;
    const totalRounds = roundHistory.length;

    // Most-played course
    const courseCounts: Record<string, number> = {};
    roundHistory.forEach(r => {
      const name = r.course.name;
      courseCounts[name] = (courseCounts[name] || 0) + 1;
    });
    const topCourse = Object.entries(courseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Lifetime net P&L (sum of first player's results as proxy for "you")
    let lifetimeNet = 0;
    roundHistory.forEach(r => {
      const totals = calculateRoundTotals(r);
      const firstPlayerId = r.players[0]?.id;
      if (firstPlayerId && totals[firstPlayerId]) {
        lifetimeNet += totals[firstPlayerId];
      }
    });

    return { totalRounds, topCourse, lifetimeNet };
  }, [roundHistory]);

  // Categorize filtered rounds
  const allSorted = [...filteredHistory].sort((a, b) => b.startTime - a.startTime);
  const recentIds = new Set(allSorted.slice(0, 3).map(r => r.id));

  const recentRounds = filteredHistory
    .filter(r => r.status === 'ACTIVE' || r.status === 'COMPLETE' || recentIds.has(r.id))
    .sort((a, b) => b.startTime - a.startTime);

  const completedRounds = filteredHistory
    .filter(r => r.status === 'LOCKED' && !recentIds.has(r.id))
    .sort((a, b) => b.startTime - a.startTime);

  const hasNoRounds = roundHistory.length === 0;
  const hasNoResults = filteredHistory.length === 0 && !hasNoRounds;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-muted rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Past Rounds</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-lg border border-border p-3 text-center">
              <div className="text-lg font-bold">{stats.totalRounds}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rounds</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-3 text-center">
              <div className="text-sm font-bold truncate">{stats.topCourse}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Top Course</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-3 text-center">
              <div className={`text-lg font-bold ${stats.lifetimeNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatMoney(stats.lifetimeNet)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Net P&L</div>
            </div>
          </div>
        )}

        {/* Search */}
        {!hasNoRounds && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course or player..."
              className="pl-9"
            />
          </div>
        )}

        {hasNoRounds ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="bg-muted/50 p-6 rounded-full mb-4">
              <History className="w-12 h-12 opacity-50" />
            </div>
            <p className="font-semibold">No rounds saved yet.</p>
            <p className="text-sm mb-4">Start a round to see your history here.</p>
            <Button onClick={() => navigate('/setup')} className="gap-2">
              <Plus className="w-4 h-4" /> Start New Round
            </Button>
          </div>
        ) : hasNoResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 opacity-50 mb-2" />
            <p className="text-sm">No rounds match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {recentRounds.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Rounds</h2>
                {recentRounds.map(round => (
                  <RoundCard
                    key={round.id}
                    round={round}
                    onView={handleViewRound}
                    onDelete={round.status !== 'LOCKED' && !round.isShared ? handleDeleteClick : undefined}
                    onToggleFavorite={!round.isShared ? handleToggleFavorite : undefined}
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
                    onToggleFavorite={!round.isShared ? handleToggleFavorite : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this round and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoundHistory;
