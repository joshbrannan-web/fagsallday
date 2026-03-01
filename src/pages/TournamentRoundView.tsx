import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Play, CheckCircle, Plus, Trash2, Share2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TeeTimeGroup {
  id: string;
  playerIds: string[];
  scorekeeperId: string | null;
}

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
    updateRoundTeams,
    setScorekeeper,
  } = useTournament(id);

  const [currentHole, setCurrentHole] = useState(1);
  const [teeTimeGroups, setTeeTimeGroups] = useState<TeeTimeGroup[]>([]);
  const [isGeneratingLinks, setIsGeneratingLinks] = useState(false);
  const [generatedShareText, setGeneratedShareText] = useState<string | null>(null);

  const round = rounds.find(r => r.id === roundId);

  // Initialize tee time groups from teams_data if available
  React.useEffect(() => {
    if (round && round.status === 'SETUP' && teeTimeGroups.length === 0) {
      const existing = (round.teams_data || []) as TeeTimeGroup[];
      if (existing.length > 0 && existing[0]?.playerIds) {
        setTeeTimeGroups(existing);
      }
    }
  }, [round]);

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

  // Tee Time helpers
  const addTeeTimeGroup = () => {
    setTeeTimeGroups(prev => [...prev, {
      id: crypto.randomUUID(),
      playerIds: [],
      scorekeeperId: null,
    }]);
  };

  const removeTeeTimeGroup = (idx: number) => {
    setTeeTimeGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const togglePlayerInGroup = (groupIdx: number, playerId: string) => {
    setTeeTimeGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) {
        // Remove from other groups
        return { ...g, playerIds: g.playerIds.filter(id => id !== playerId), scorekeeperId: g.scorekeeperId === playerId ? null : g.scorekeeperId };
      }
      const inGroup = g.playerIds.includes(playerId);
      return {
        ...g,
        playerIds: inGroup ? g.playerIds.filter(id => id !== playerId) : [...g.playerIds, playerId],
        scorekeeperId: inGroup && g.scorekeeperId === playerId ? null : g.scorekeeperId,
      };
    }));
  };

  const setGroupScorekeeper = (groupIdx: number, playerId: string) => {
    setTeeTimeGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, scorekeeperId: g.scorekeeperId === playerId ? null : playerId } : g
    ));
  };

  const assignedPlayerIds = new Set(teeTimeGroups.flatMap(g => g.playerIds));

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
    // Save tee time groups to teams_data
    if (teeTimeGroups.length > 0) {
      await updateRoundTeams(round.id, teeTimeGroups);
    }

    // If we have scorekeepers, generate links
    const scorekeepers = teeTimeGroups.filter(g => g.scorekeeperId);
    if (scorekeepers.length > 0) {
      setIsGeneratingLinks(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-tournament-round-links', {
          body: {
            tournament_id: id,
            round_id: round.id,
            tee_times: teeTimeGroups.map(g => ({
              scorekeeper_user_id: g.scorekeeperId,
              player_ids: g.playerIds,
            })),
          },
        });

        if (error) {
          console.error('Link generation error:', error);
          toast.error('Failed to generate scorekeeper links');
        } else if (data?.shareText) {
          setGeneratedShareText(data.shareText);
        }
      } catch (err) {
        console.error('Link generation error:', err);
      } finally {
        setIsGeneratingLinks(false);
      }
    }

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

  const handleShareLinks = async () => {
    if (!generatedShareText) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: generatedShareText });
      } catch {
        await navigator.clipboard.writeText(generatedShareText);
        toast.success('Links copied to clipboard');
      }
    } else {
      await navigator.clipboard.writeText(generatedShareText);
      toast.success('Links copied to clipboard');
    }
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

      {/* SETUP: Tee Time Configuration */}
      {round.status === 'SETUP' && isCreator && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Tee Times</h2>
            <Button size="sm" variant="outline" onClick={addTeeTimeGroup} className="gap-1">
              <Plus className="w-4 h-4" /> Add Group
            </Button>
          </div>

          {teeTimeGroups.length === 0 && (
            <p className="text-sm text-muted-foreground bg-card border rounded-lg p-4 text-center">
              Add tee time groups and assign players. Pick one scorekeeper per group to share a scoring link.
            </p>
          )}

          {teeTimeGroups.map((group, gi) => (
            <div key={group.id} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Group {gi + 1}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTeeTimeGroup(gi)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Player assignment */}
              <div>
                <label className="text-xs text-muted-foreground">Players</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {players.map(p => {
                    const inThisGroup = group.playerIds.includes(p.id);
                    const inOtherGroup = !inThisGroup && assignedPlayerIds.has(p.id);
                    if (inOtherGroup) return null;
                    return (
                      <Badge
                        key={p.id}
                        variant={inThisGroup ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => togglePlayerInGroup(gi, p.id)}
                      >
                        {p.player_name}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Scorekeeper selection */}
              {group.playerIds.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Scorekeeper</label>
                  <Select
                    value={group.scorekeeperId || ''}
                    onValueChange={v => setGroupScorekeeper(gi, v)}
                  >
                    <SelectTrigger className="text-xs h-8 mt-1">
                      <SelectValue placeholder="Pick scorekeeper" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.playerIds.map(pid => {
                        const p = players.find(pl => pl.id === pid);
                        return p ? (
                          <SelectItem key={pid} value={pid} className="text-xs">
                            {p.player_name}
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}

          {/* Generated links display */}
          {generatedShareText && (
            <div className="bg-accent/20 border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Scorekeeper Links Generated</span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{generatedShareText}</p>
              <Button size="sm" className="w-full gap-1" onClick={handleShareLinks}>
                <Share2 className="w-4 h-4" /> Share Links
              </Button>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleStartRound}
            className="w-full gap-1"
            disabled={isGeneratingLinks}
          >
            {isGeneratingLinks ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {teeTimeGroups.some(g => g.scorekeeperId) ? 'Start Round & Generate Links' : 'Start Round'}
          </Button>
        </div>
      )}

      {/* Non-creator SETUP view */}
      {round.status === 'SETUP' && !isCreator && (
        <div className="bg-card border rounded-lg p-4 text-center mb-4">
          <p className="text-sm text-muted-foreground">Waiting for the organizer to start this round...</p>
        </div>
      )}

      {/* Round Controls (non-setup) */}
      {isCreator && round.status === 'ACTIVE' && (
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={handleCompleteRound} className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Complete Round
          </Button>
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
