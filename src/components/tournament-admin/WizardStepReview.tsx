import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Flag } from 'lucide-react';
import type { TeamData } from './WizardStepTeams';
import type { PlayerData } from './WizardStepPlayers';
import type { RoundConfigData } from './RoundConfigCard';

const GAME_LABELS: Record<string, string> = {
  match_play_individual: 'Individual Match Play (1v1)',
  match_play_best_ball: 'Best Ball Match Play (2v2)',
  match_play_gross_best_ball: 'Gross Best Ball (4-man)',
  scramble_2: 'Scramble (2-man)',
  scramble_4: 'Scramble (4-man)',
  alternate_shot_twosomes: 'Alternate Shot — Twosomes',
  alternate_shot_foursomes: 'Alternate Shot — Foursomes',
  tournament_sixes: 'Tournament Sixes',
  blind_gross_best_ball: 'Blind Gross Best Ball',
  two_man_score: '2 Man Score (2v2)',
};

interface Props {
  basicInfo: { name: string; description: string; startDate: string; endDate: string; numRounds: number; teamScoringMethod?: string };
  teams: TeamData[];
  players: PlayerData[];
  rounds: RoundConfigData[];
}

const WizardStepReview: React.FC<Props> = ({ basicInfo, teams, players, rounds }) => {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-1">{basicInfo.name}</h3>
        {basicInfo.description && <p className="text-sm text-muted-foreground mb-2">{basicInfo.description}</p>}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{basicInfo.startDate} → {basicInfo.endDate}</span>
          <span className="flex items-center gap-1"><Flag className="w-3.5 h-3.5" /> {basicInfo.numRounds} rounds</span>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-2">Teams & Players</h4>
        {teams.map((team, ti) => (
          <div key={ti} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="font-medium text-sm">{team.name}</span>
              <Badge variant="secondary" className="text-xs">
                {players.filter(p => p.teamIndex === ti).length} players
              </Badge>
            </div>
            <div className="pl-5 space-y-0.5">
              {players.filter(p => p.teamIndex === ti).map((p, pi) => (
                <p key={pi} className="text-xs text-muted-foreground">{p.displayName} (HCP: {p.handicapIndex})</p>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-2">Rounds</h4>
        {rounds.map((r, ri) => (
          <div key={ri} className="mb-2 last:mb-0">
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-muted-foreground">
              {GAME_LABELS[r.gameType] || r.gameType}
              {r.gameType === 'match_play_best_ball' && (
                <span className="ml-1">• 2nd Ball: {r.secondBallTiebreaker ? 'On' : 'Off'}</span>
              )}
              {r.roundDate && ` • ${r.roundDate}`}
            </p>
            {basicInfo.teamScoringMethod === 'custom_pts_per_round' && r.teamScoringMode === 'per_hole' && (
              <p className="text-xs text-muted-foreground">Team scoring: per hole</p>
            )}
            {basicInfo.teamScoringMethod === 'custom_pts_per_round' && r.teamScoringMode === 'per_round' && (
              <p className="text-xs text-muted-foreground">Team scoring: {r.teamScoringPoints.round} pt(s) for the round win</p>
            )}
            {basicInfo.teamScoringMethod === 'custom_pts_per_round' && r.teamScoringMode === 'fbo' && (
              <p className="text-xs text-muted-foreground">
                Team scoring: Front {r.teamScoringPoints.front} / Back {r.teamScoringPoints.back} / Overall {r.teamScoringPoints.overall}
              </p>
            )}
            {r.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{r.notes}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
};

export default WizardStepReview;
