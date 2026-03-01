import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const TournamentRoundView: React.FC = () => {
  const { id, roundId } = useParams<{ id: string; roundId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tournament,
    players,
    rounds,
    isLoading,
    isCreator,
    updateRoundScores,
    updateRoundPoints,
    updateRoundStatus,
    setScorekeeper,
  } = useTournament(id);

  const [currentHole, setCurrentHole] = useState(1);

  const round = rounds.find(r => r.id === roundId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament || !round) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <p className="text-muted-foreground mb-4">Round not found</p>
        <Button onClick={() => navigate(`/tournament/${id}`)}>Back</Button>
      </div>
    );
  }

  const canEditScores = isCreator || round.scorekeeper_id === user?.id;
  const scores = (round.scores || {}) as Record<string, Record<string, number>>;
  const pointsData = (round.points_data || {}) as Record<string, number>;

  const handleScoreChange = async (playerId: string, value: string) => {
    const score = parseInt(value);
    if (isNaN(score) || score < 1 || score > 15) return;

    const newScores = { ...scores };
    if (!newScores[currentHole]) newScores[currentHole] = {};
    newScores[currentHole][playerId] = score;
    await updateRoundScores(round.id, newScores);
  };

  const handlePointsChange = async (playerId: string, value: string) => {
    const pts = parseFloat(value);
    if (isNaN(pts)) return;

    const newPoints = { ...pointsData, [playerId]: pts };
    await updateRoundPoints(round.id, newPoints);
  };

  const handleStartRound = async () => {
    await updateRoundStatus(round.id, 'ACTIVE');
    toast.success('Round started!');
  };

  const handleCompleteRound = async () => {
    await updateRoundStatus(round.id, 'COMPLETE');
    toast.success('Round completed!');
  };

  const handleSetScorekeeper = async () => {
    if (!user) return;
    await setScorekeeper(round.id, user.id);
    toast.success('You are now the scorekeeper');
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tournament/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">
            Round {round.round_number}
            {(round.course_data as any)?.name && ` — ${(round.course_data as any).name}`}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{round.status.toLowerCase()}</p>
        </div>
      </div>

      {/* Round Controls */}
      {isCreator && (
        <div className="flex gap-2 mb-4">
          {round.status === 'SETUP' && (
            <Button size="sm" onClick={handleStartRound} className="gap-1">
              <Play className="w-4 h-4" />
              Start Round
            </Button>
          )}
          {round.status === 'ACTIVE' && (
            <Button size="sm" variant="outline" onClick={handleCompleteRound} className="gap-1">
              <CheckCircle className="w-4 h-4" />
              Complete Round
            </Button>
          )}
        </div>
      )}

      {/* Scorekeeper claim */}
      {round.status === 'ACTIVE' && !round.scorekeeper_id && !isCreator && (
        <Button size="sm" variant="outline" onClick={handleSetScorekeeper} className="mb-4">
          Become Scorekeeper
        </Button>
      )}

      {/* Hole Navigation */}
      {round.status !== 'SETUP' && (
        <>
          <div className="flex items-center justify-between mb-4 bg-card border rounded-lg p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentHole(h => Math.max(1, h - 1))}
              disabled={currentHole <= 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-bold text-foreground">Hole {currentHole}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentHole(h => Math.min(18, h + 1))}
              disabled={currentHole >= 18}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Scores */}
          <div className="space-y-3 mb-6">
            <h2 className="font-semibold text-foreground">Scores — Hole {currentHole}</h2>
            {players.map(p => {
              const holeScores = scores[currentHole] || {};
              const playerScore = holeScores[p.id];
              return (
                <div key={p.id} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{p.player_name}</p>
                    <p className="text-xs text-muted-foreground">HCP: {p.handicap_index}</p>
                  </div>
                  {canEditScores ? (
                    <Input
                      type="number"
                      className="w-16 text-center"
                      value={playerScore ?? ''}
                      onChange={e => handleScoreChange(p.id, e.target.value)}
                      min={1}
                      max={15}
                    />
                  ) : (
                    <span className="text-lg font-bold text-foreground w-16 text-center">
                      {playerScore ?? '—'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Points (for points mode, editable by creator) */}
          {tournament.scoring_mode === 'points' && isCreator && (
            <div className="space-y-3">
              <h2 className="font-semibold text-foreground">Points (Total for this round)</h2>
              {players.map(p => (
                <div key={p.id} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                  <p className="font-medium text-foreground">{p.player_name}</p>
                  <Input
                    type="number"
                    className="w-20 text-center"
                    value={pointsData[p.id] ?? ''}
                    onChange={e => handlePointsChange(p.id, e.target.value)}
                    step={0.5}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Read-only points for non-creators */}
          {tournament.scoring_mode === 'points' && !isCreator && (
            <div className="space-y-3">
              <h2 className="font-semibold text-foreground">Points</h2>
              {players.map(p => (
                <div key={p.id} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                  <p className="font-medium text-foreground">{p.player_name}</p>
                  <span className="text-lg font-bold text-foreground">
                    {pointsData[p.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Hole Quick Nav */}
          <div className="mt-6 grid grid-cols-9 gap-1">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
              const hasScores = Object.keys(scores[h] || {}).length > 0;
              return (
                <button
                  key={h}
                  onClick={() => setCurrentHole(h)}
                  className={`rounded p-1.5 text-xs font-medium transition-colors ${
                    h === currentHole
                      ? 'bg-primary text-primary-foreground'
                      : hasScores
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default TournamentRoundView;
