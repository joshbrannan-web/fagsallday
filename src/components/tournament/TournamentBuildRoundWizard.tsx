import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Trophy, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentRoundSetup } from '@/hooks/useTournamentRoundSetup';
import TournamentRoundCard, { GAME_TYPE_LABELS } from './TournamentRoundCard';
import TournamentRulesCallout from './TournamentRulesCallout';
import TournamentPlayerSelector from './TournamentPlayerSelector';
import TournamentGroupSelector from './TournamentGroupSelector';
import TournamentTeamAssigner from './TournamentTeamAssigner';
import GameSelector from '@/components/GameSelector';
import { useAuth } from '@/hooks/useAuth';
import { GAME_LIBRARY, GAME_DETAILS } from '@/lib/gameLibrary';
import { Player, GameSettings, GameType } from '@/types';

// Steps: 1=Welcome, 2=Round, 3=Course, 4=Players/Group, 5=Teams, 6=SideGames, 7=Review
const TOTAL_STEPS = 7;

const TournamentBuildRoundWizard: React.FC = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [tournamentId, setTournamentId] = useState<string | undefined>();

  // Resolve joinCode to tournamentId
  useEffect(() => {
    if (!joinCode) return;
    supabase
      .from('tournaments')
      .select('id')
      .ilike('join_code', joinCode.toUpperCase())
      .single()
      .then(({ data }) => {
        if (data) setTournamentId(data.id);
        else navigate('/tournament');
      });
  }, [joinCode, navigate]);

  const setup = useTournamentRoundSetup(tournamentId);

  if (setup.isLoading || !setup.tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasPresetGroups = setup.roundGroups.length > 0;
  // When groups are pre-set: skip steps 4 (player select) and 5 (team assign) — replace with group select
  // Effective steps: 1=Welcome, 2=Round, 3=Course, 4=GroupSelect, 5=SideGames, 6=Review (6 total)
  const totalSteps = hasPresetGroups ? 6 : TOTAL_STEPS;

  const canProceed = (): boolean => {
    if (hasPresetGroups) {
      switch (step) {
        case 1: return true;
        case 2: return !!setup.selectedRound && !!setup.tournamentGame;
        case 3: return true;
        case 4: return !!setup.selectedGroupId;
        case 5: return true;
        case 6: return true;
        default: return false;
      }
    }
    switch (step) {
      case 1: return true;
      case 2: return !!setup.selectedRound && !!setup.tournamentGame;
      case 3: return true;
      case 4: return setup.selectedPlayers.length === setup.requiredPlayerCount;
      case 5: return true;
      case 6: return true;
      case 7: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!hasPresetGroups && step === 5 && setup.isScrambleFormat) {
      setStep(6);
      return;
    }
    if (step < totalSteps) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (!hasPresetGroups && step === 6 && setup.isScrambleFormat) {
      setStep(4);
      return;
    }
    if (step > 1) setStep(s => s - 1);
    else navigate('/tournament');
  };

  const handleStart = () => {
    setup.startRound();
  };

  const renderStep = () => {
    if (hasPresetGroups) {
      switch (step) {
        case 1: return renderStep1();
        case 2: return renderStep2();
        case 3: return renderStep3();
        case 4: return renderGroupSelect();
        case 5: return renderStep6(); // side games
        case 6: return renderStep7(); // review
      }
    } else {
      switch (step) {
        case 1: return renderStep1();
        case 2: return renderStep2();
        case 3: return renderStep3();
        case 4: return renderStep4();
        case 5: return renderStep5();
        case 6: return renderStep6();
        case 7: return renderStep7();
      }
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Trophy className="w-12 h-12 mx-auto mb-3 text-[hsl(var(--brand-gold))]" />
        <h2 className="text-2xl font-bold">{setup.tournament!.name}</h2>
        {setup.tournament!.description && (
          <p className="text-muted-foreground mt-2">{setup.tournament!.description}</p>
        )}
      </div>
      {setup.currentUserTeam && (
        <div className="flex items-center justify-center gap-2 p-3 bg-card rounded-lg border border-border">
          <span className="text-sm">You are on</span>
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: setup.currentUserTeam.color }} />
          <span className="font-semibold">{setup.currentUserTeam.name}</span>
        </div>
      )}
      <p className="text-center text-muted-foreground">
        Round {setup.completedRoundCount} of {setup.tournament!.num_rounds} complete
      </p>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Choose a Round</h2>
      <div className="space-y-3">
        {setup.rounds.map(round => {
          const isPending = round.status === 'pending';
          return (
          <div key={round.id} className={isPending ? 'opacity-50' : ''}>
            <TournamentRoundCard
              round={round}
              gameType={setup.selectedRound?.id === round.id ? setup.tournamentGame?.game_type : undefined}
              rulesText={setup.selectedRound?.id === round.id ? setup.tournamentGame?.rules_text || undefined : undefined}
              isSelected={setup.selectedRound?.id === round.id}
              onSelect={() => { if (!isPending) setup.selectRound(round); }}
              disabled={isPending}
            />
            {isPending && (
              <p className="text-xs text-muted-foreground mt-1 ml-1">
                This round hasn't been opened by the admin yet.
              </p>
            )}
            {setup.selectedRound?.id === round.id && round.status === 'completed' && (
              <div className="mt-2 flex items-center gap-2 p-3 bg-yellow-950/30 border border-yellow-500/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-200">This round is marked complete. Are you sure you want to start a new group?</p>
              </div>
            )}
            {setup.selectedRound?.id === round.id && setup.tournamentGame && (
              <div className="mt-3 space-y-3 pl-2 border-l-2 border-primary/30">
                {setup.tournamentGame.rules_text && (
                  <TournamentRulesCallout text={setup.tournamentGame.rules_text} />
                )}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Points/hole: {setup.tournamentGame.default_points_per_hole}</span>
                  <span>Halved: {setup.tournamentGame.halved_hole_rule === 'half_point' ? '½ pt each' : 'No points'}</span>
                  <span>Handicaps: {setup.tournamentGame.use_handicaps ? `On (${setup.tournamentGame.handicap_allowance_percent}%)` : 'Off'}</span>
                  {setup.tournamentGame.max_score_per_hole && <span>Max score: {setup.tournamentGame.max_score_per_hole}</span>}
                </div>
                <Button size="sm" onClick={() => setStep(3)}>Select This Round →</Button>
              </div>
            )}
          </div>
        );
        })}
      </div>
    </div>
  );

  const renderStep3 = () => {
    if (!setup.selectedRound || !setup.tournamentGame) return null;
    const course = setup.selectedRound.course_data as any;
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Confirm Course & Game</h2>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{course?.name || 'TBD'}</h3>
          {course?.location && <p className="text-sm text-muted-foreground">{course.location}</p>}
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>Par {course?.holes?.reduce((s: number, h: any) => s + h.par, 0) || 72}</span>
            <span>{course?.holes?.reduce((s: number, h: any) => s + h.yardage, 0)?.toLocaleString() || 0} yds</span>
            <span>18 holes</span>
          </div>
        </div>
        <div>
          <p className="text-lg font-bold text-[hsl(var(--brand-gold))]">
            {GAME_TYPE_LABELS[setup.tournamentGame.game_type] || setup.tournamentGame.game_type}
          </p>
        </div>
        {setup.tournamentGame.rules_text && (
          <TournamentRulesCallout text={setup.tournamentGame.rules_text} />
        )}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Points per hole: {setup.tournamentGame.default_points_per_hole}</p>
          {setup.holePoints.length > 0 && (
            <p>Custom point values on holes: {setup.holePoints.map(hp => `#${hp.hole_number}: ${hp.points}`).join(', ')}</p>
          )}
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Who's in your group?</h2>
      <TournamentPlayerSelector
        players={setup.allPlayers}
        selectedPlayers={setup.selectedPlayers}
        teams={setup.teams}
        currentUserId={user?.id}
        requiredCount={setup.requiredPlayerCount}
        onToggle={setup.togglePlayer}
        isGrouped={setup.isPlayerAlreadyGrouped}
      />
    </div>
  );

  const renderGroupSelect = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Select Your Group</h2>
      <p className="text-sm text-muted-foreground">Your admin has set up the pairings. Pick the group you're playing in.</p>
      <TournamentGroupSelector
        groups={setup.roundGroups}
        groupPlayers={setup.roundGroupPlayers}
        players={setup.allPlayers}
        teams={setup.teams}
        selectedGroupId={setup.selectedGroupId}
        currentUserId={user?.id}
        onSelect={setup.selectGroup}
      />
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Team Assignments</h2>
      <p className="text-sm text-muted-foreground">Players are assigned to their tournament teams.</p>
      <TournamentTeamAssigner
        players={setup.selectedPlayers}
        teams={setup.teams}
        teamAssignments={setup.teamAssignments}
        currentUserId={user?.id}
      />
    </div>
  );

  const renderStep6 = () => {
    const mappedPlayers: Player[] = setup.selectedPlayers.map(p => ({
      id: p.id,
      name: p.display_name,
      handicapIndex: p.handicap_index ?? 0,
      courseHandicap: 0,
      tee: '',
    }));

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Add Side Games?</h2>
        <p className="text-sm text-muted-foreground">
          Optional — add betting games alongside the tournament. These won't affect the leaderboard.
        </p>
        <GameSelector
          players={mappedPlayers}
          selectedGames={sideGames}
          onGamesChange={setup.setSideGames}
        />
      </div>
    );
  };

  const sideGames = setup.sideGames;

  const renderStep7 = () => {
    if (!setup.tournament || !setup.selectedRound || !setup.tournamentGame) return null;
    const course = setup.selectedRound.course_data as any;
    const teamGroups: Record<string, string[]> = {};
    setup.selectedPlayers.forEach(p => {
      const tid = setup.teamAssignments[p.id] || 'unassigned';
      if (!teamGroups[tid]) teamGroups[tid] = [];
      teamGroups[tid].push(p.display_name);
    });

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Ready to Play?</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Tournament</p>
            <p className="font-semibold">{setup.tournament.name}</p>
            <p className="text-sm text-muted-foreground">
              Round {setup.selectedRound.round_number}{setup.selectedRound.name ? ` — ${setup.selectedRound.name}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">{course?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Group</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {setup.selectedPlayers.map(p => {
                const team = setup.teams.find(t => t.id === setup.teamAssignments[p.id]);
                return (
                  <span key={p.id} className="flex items-center gap-1 text-sm">
                    {team && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />}
                    {p.display_name}
                  </span>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Tournament Game</p>
            <p className="font-semibold text-[hsl(var(--brand-gold))]">
              {GAME_TYPE_LABELS[setup.tournamentGame.game_type] || setup.tournamentGame.game_type}
            </p>
          </div>
          {setup.tournamentGame.rules_text && (
            <TournamentRulesCallout text={setup.tournamentGame.rules_text} />
          )}
          {sideGames.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Side Games</p>
              {sideGames.map(g => (
                <p key={g.id} className="text-sm">{g.name} — ${g.unitStake}/unit</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Tournament scores update the live leaderboard as you play. Side game results are only visible to your group.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <span className="text-sm text-muted-foreground">Step {step} of {totalSteps}</span>
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {renderStep()}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        {step < totalSteps ? (
          <Button className="w-full" onClick={handleNext} disabled={!canProceed()}>
            Continue <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button className="w-full" onClick={handleStart} disabled={setup.isStarting}>
            {setup.isStarting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Start Round 🏌️
          </Button>
        )}
      </div>
    </div>
  );
};

export default TournamentBuildRoundWizard;
