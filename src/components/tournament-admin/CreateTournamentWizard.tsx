import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTournaments } from '@/hooks/useTournaments';
import WizardStepBasicInfo from './WizardStepBasicInfo';
import WizardStepTeams, { TeamData } from './WizardStepTeams';
import WizardStepPlayers, { PlayerData } from './WizardStepPlayers';
import WizardStepRounds from './WizardStepRounds';
import WizardStepReview from './WizardStepReview';
import { defaultRoundConfig, RoundConfigData } from './RoundConfigCard';

const STEPS = ['Basic Info', 'Teams', 'Players', 'Rounds', 'Review'];

const CreateTournamentWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkConfigId = searchParams.get('linkConfigId');
  const { createTournament } = useTournaments();
  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const [basicInfo, setBasicInfo] = useState({
    name: '', description: '', startDate: '', endDate: '', numRounds: 2,
    teamScoringMethod: 'cumulative' as 'cumulative' | 'round_win' | 'custom_pts_per_round',
    customRoundPoints: 3,
  });
  const [teams, setTeams] = useState<TeamData[]>([
    { name: 'Team A', color: '#1d4ed8' },
    { name: 'Team B', color: '#dc2626' },
  ]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [rounds, setRounds] = useState<RoundConfigData[]>([defaultRoundConfig(1), defaultRoundConfig(2)]);

  // Sync rounds array length with numRounds
  const handleBasicInfoChange = (data: typeof basicInfo) => {
    setBasicInfo(data);
    const diff = data.numRounds - rounds.length;
    if (diff > 0) setRounds(prev => [...prev, ...Array.from({ length: diff }, (_, i) => defaultRoundConfig(prev.length + i + 1))]);
    else if (diff < 0) setRounds(prev => prev.slice(0, data.numRounds));
  };

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!basicInfo.name.trim()) return 'Tournament name is required';
        if (!basicInfo.startDate) return 'Start date is required';
        if (!basicInfo.endDate) return 'End date is required';
        if (basicInfo.endDate < basicInfo.startDate) return 'End date must be after start date';
        return null;
      case 1:
        if (teams.length < 2) return 'At least 2 teams required';
        if (teams.some(t => !t.name.trim())) return 'All teams must have a name';
        return null;
      case 2:
        if (players.length < 2) return 'At least 2 players required';
        const teamCounts = teams.map((_, i) => players.filter(p => p.teamIndex === i).length);
        if (teamCounts.some(c => c === 0)) return 'Each team must have at least 1 player';
        return null;
      case 3:
        const incomplete = rounds.findIndex(r => !r.gameType);
        if (incomplete >= 0) return `Round ${incomplete + 1} needs a game type`;
        return null;
      default: return null;
    }
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep(s => s + 1);
  };

  const handlePublish = async () => {
    setPublishing(true);
    const joinCode = await createTournament({
      name: basicInfo.name,
      description: basicInfo.description || undefined,
      startDate: basicInfo.startDate,
      endDate: basicInfo.endDate,
      numRounds: basicInfo.numRounds,
      teamScoringMethod: basicInfo.teamScoringMethod,
      customRoundPoints: basicInfo.customRoundPoints,
      teams: teams.map((t, i) => ({ name: t.name, color: t.color, displayOrder: i })),
      players: players.map(p => ({
        displayName: p.displayName,
        handicapIndex: p.handicapIndex,
        teamIndex: p.teamIndex,
        userId: p.userId,
      })),
      rounds: rounds.map((r, i) => ({
        roundNumber: i + 1,
        name: r.name,
        courseData: r.courseData || {},
        roundDate: r.roundDate || undefined,
        notes: r.notes || undefined,
        game: {
          gameType: r.gameType,
          defaultPointsPerHole: r.defaultPointsPerHole,
          halvedHoleRule: r.halvedHoleRule,
          secondBallTiebreaker: r.secondBallTiebreaker,
          useHandicaps: r.useHandicaps,
          handicapAllowancePercent: r.handicapAllowancePercent,
          maxScorePerHole: r.maxScoreEnabled ? r.maxScorePerHole : undefined,
          sixesConfig: r.gameType === 'tournament_sixes' ? r.sixesConfig : undefined,
          rulesText: r.notes || undefined,
        },
        teamScoringMode: r.teamScoringMode,
        teamScoringPoints: r.teamScoringPoints,
        holePointOverrides: r.holePointOverrides
          .map((pts, hi) => ({ holeNumber: hi + 1, points: pts }))
          .filter(hp => hp.points !== r.defaultPointsPerHole),
      })),
    });

    setPublishing(false);
    if (joinCode) {
      toast.success(`Tournament created! Join code: ${joinCode}`);
      if (linkConfigId) {
        const { data: newT } = await supabase
          .from('tournaments')
          .select('id')
          .eq('join_code', joinCode)
          .maybeSingle();
        if (newT?.id) {
          const { error: linkErr } = await supabase
            .from('tournament_registration_configs')
            .update({ tournament_id: newT.id })
            .eq('id', linkConfigId);
          if (linkErr) {
            toast.error('Tournament created, but failed to link to registration');
          } else {
            toast.success('Linked to registration');
          }
        }
        navigate(`/tournament-admin/registrations/${linkConfigId}`);
        return;
      }
      navigate('/tournament-admin');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/tournament-admin')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Create Tournament</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            <span className={`text-[10px] mt-1 ${i === step ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="max-w-lg mx-auto">
        {step === 0 && <WizardStepBasicInfo data={basicInfo} onChange={handleBasicInfoChange} />}
        {step === 1 && <WizardStepTeams teams={teams} onChange={setTeams} />}
        {step === 2 && <WizardStepPlayers players={players} teams={teams} onChange={setPlayers} />}
        {step === 3 && <WizardStepRounds rounds={rounds} onChange={setRounds} showTeamScoring={basicInfo.teamScoringMethod === 'custom_pts_per_round'} />}
        {step === 4 && <WizardStepReview basicInfo={basicInfo} teams={teams} players={players} rounds={rounds} />}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button className="flex-1" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button className="flex-1" onClick={handlePublish} disabled={publishing}>
              {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publish Tournament
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTournamentWizard;
