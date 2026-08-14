import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ChevronDown, Info } from 'lucide-react';
import type { TournamentGameType } from '@/types/tournament';

const TOURNAMENT_GAME_DETAILS: Record<TournamentGameType, { name: string; description: string }> = {
  match_play_individual: {
    name: 'Individual Match Play (1v1)',
    description: 'Two players compete head-to-head. Each hole is worth a set number of points — the player with the lowest net (or gross) score wins the hole. If scores are tied, the halved-hole rule applies. The player with the most points at the end wins the match.',
  },
  match_play_best_ball: {
    name: 'Best Ball Match Play (2v2)',
    description: 'Two teams of 2 players. On each hole, every player plays their own ball. The lowest net score from each team is compared — the team with the lower score wins the hole and earns points. If the best balls are tied, the halved-hole rule applies. Optional: second-ball tiebreaker uses the second-best score to break ties.',
  },
  match_play_gross_best_ball: {
    name: 'Gross Best Ball (4-man, 6/6/6)',
    description: 'A 4-player team format using gross scores with a rotating count. Holes 1–6: best 2 of 4 scores count. Holes 7–12: best 3 of 4 scores count. Holes 13–18: all 4 scores count. Teams are compared hole-by-hole using this format.',
  },
  scramble_2: {
    name: 'Scramble (2-man)',
    description: 'Both players tee off. The team selects the best shot, and both play from that spot. This repeats until the ball is holed. The team records one score per hole. Great for pace of play and team camaraderie.',
  },
  scramble_4: {
    name: 'Scramble (4-man)',
    description: 'All four players tee off. The team selects the best shot, and all play from that spot. This repeats until the ball is holed. The team records one score per hole. A fun, social format that keeps everyone involved.',
  },
  alternate_shot_twosomes: {
    name: 'Alternate Shot — Twosomes',
    description: 'Two players share one ball per hole. They alternate shots — one tees off on odd holes, the other on even holes. After the tee shot, they continue alternating until the ball is holed. Strategy on who tees off on which holes is key.',
  },
  alternate_shot_foursomes: {
    name: 'Alternate Shot — Foursomes',
    description: 'Two teams of 2 each play one ball per team. Partners alternate shots within each hole and alternate who tees off. The classic Ryder Cup foursomes format — requires teamwork and consistency.',
  },
  tournament_sixes: {
    name: 'Tournament Sixes',
    description: 'The round is split into three 6-hole segments. Within a 4-player group, team pairings rotate each segment so every player partners with every other player once. Points are awarded per segment based on match play or sum-of-strokes results. A great format for mixing things up within a group.',
  },
  blind_gross_best_ball: {
    name: 'Blind Gross Best Ball',
    description: 'Same as Gross Best Ball (6/6/6) but team assignments are revealed after the round. Players play their own ball without knowing who their teammates are. Holes 1–6: best 2 of 4, Holes 7–12: best 3 of 4, Holes 13–18: all 4. Adds an element of surprise!',
  },
  two_man_score: {
    name: '2 Man Score (2v2)',
    description: 'Two teams of 2 players. On each hole, both players\' scores are summed — the team with the lower combined score wins the hole. Supports gross or net scoring. If totals are tied, the halved-hole rule applies. A classic team match play format.',
  },
};
import CoursePicker from '@/components/CoursePicker';
import type { Course } from '@/types';

const GAME_TYPES: { value: TournamentGameType; label: string }[] = [
  { value: 'match_play_individual', label: 'Individual Match Play (1v1)' },
  { value: 'match_play_best_ball', label: 'Best Ball Match Play (2v2)' },
  { value: 'match_play_gross_best_ball', label: 'Gross Best Ball (4-man, 6/6/6)' },
  { value: 'scramble_2', label: 'Scramble (2-man)' },
  { value: 'scramble_4', label: 'Scramble (4-man)' },
  { value: 'alternate_shot_twosomes', label: 'Alternate Shot — Twosomes' },
  { value: 'alternate_shot_foursomes', label: 'Alternate Shot — Foursomes' },
  { value: 'tournament_sixes', label: 'Tournament Sixes' },
  { value: 'blind_gross_best_ball', label: 'Blind Gross Best Ball' },
  { value: 'two_man_score', label: '2 Man Score (2v2)' },
];

export interface RoundConfigData {
  name: string;
  roundDate: string;
  courseData: any;
  notes: string;
  gameType: TournamentGameType | '';
  defaultPointsPerHole: number;
  halvedHoleRule: 'half_point' | 'no_points';
  useHandicaps: boolean;
  handicapAllowancePercent: number;
  maxScoreEnabled: boolean;
  maxScorePerHole: number;
  secondBallTiebreaker: boolean;
  sixesConfig: { rules: string; formatNotes: string }[];
  holePointOverrides: number[];
  holePointsCustomized: boolean;
  sixesFormat: 'match_play' | 'sum_of_strokes';
  sixesSegmentPoints: [number, number, number];
  teamScoringMode: 'per_hole' | 'per_round' | 'per_hole_and_round' | 'fbo';
  teamScoringPoints: { round: number; front: number; back: number; overall: number };
}

export const defaultRoundConfig = (num: number): RoundConfigData => ({
  name: `Round ${num}`,
  roundDate: '',
  courseData: null,
  notes: '',
  gameType: '',
  defaultPointsPerHole: 1,
  halvedHoleRule: 'half_point',
  useHandicaps: true,
  handicapAllowancePercent: 100,
  maxScoreEnabled: false,
  maxScorePerHole: 4,
  secondBallTiebreaker: false,
  sixesConfig: [
    { rules: '', formatNotes: '' },
    { rules: '', formatNotes: '' },
    { rules: '', formatNotes: '' },
  ],
  holePointOverrides: Array(18).fill(1),
  holePointsCustomized: false,
  sixesFormat: 'match_play',
  sixesSegmentPoints: [1, 1, 1],
  teamScoringMode: 'per_round',
  teamScoringPoints: { round: 3, front: 1, back: 1, overall: 2 },
});

interface Props {
  data: RoundConfigData;
  onChange: (data: RoundConfigData) => void;
  roundNumber: number;
  showTeamScoring?: boolean;
}

const RoundConfigCard: React.FC<Props> = ({ data, onChange, roundNumber, showTeamScoring }) => {
  const [showHolePoints, setShowHolePoints] = useState(false);
  const update = (key: keyof RoundConfigData, value: any) => onChange({ ...data, [key]: value });
  const updatePoints = (key: 'round' | 'front' | 'back' | 'overall', value: number) =>
    update('teamScoringPoints', { ...data.teamScoringPoints, [key]: value });

  const holePointsCount =
    !showTeamScoring || data.teamScoringMode === 'per_hole' || data.teamScoringMode === 'per_hole_and_round';

  const isComplete = data.name.trim() !== '' && data.gameType !== '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Round Name</Label>
          <Input value={data.name} onChange={e => update('name', e.target.value)} placeholder={`Round ${roundNumber}`} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={data.roundDate} onChange={e => update('roundDate', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Course</Label>
        <CoursePicker
          selectedCourse={data.courseData as Course | null}
          onCourseSelected={(course) => update('courseData', course)}
        />
      </div>

      <div>
        <Label>Notes / Rules for Players</Label>
        <textarea
          value={data.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="e.g. 2v2 Match Play, Best Ball, No Handicaps..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <Label>Game Type *</Label>
        <div className="flex items-center gap-2">
          <Select value={data.gameType} onValueChange={v => update('gameType', v)}>
            <SelectTrigger><SelectValue placeholder="Select game type..." /></SelectTrigger>
            <SelectContent>
              {GAME_TYPES.map(g => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data.gameType && TOURNAMENT_GAME_DETAILS[data.gameType as TournamentGameType] && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-accent transition-colors">
                  <Info className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <h4 className="font-semibold text-sm mb-1">{TOURNAMENT_GAME_DETAILS[data.gameType as TournamentGameType].name}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{TOURNAMENT_GAME_DETAILS[data.gameType as TournamentGameType].description}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {data.gameType && (
        <div className="space-y-4 bg-muted/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{holePointsCount ? 'Points Per Hole' : 'Points Per Hole (tiebreak only)'}</Label>
              <Input type="number" value={data.defaultPointsPerHole} onChange={e => update('defaultPointsPerHole', parseFloat(e.target.value) || 1)} min={0.5} step={0.5} />
              {!holePointsCount && (
                <p className="text-xs text-muted-foreground mt-1">
                  These points only decide who wins each hole. They do not add to team totals in this mode.
                </p>
              )}
            </div>
            <div>
              <Label>Halved Hole</Label>
              <Select value={data.halvedHoleRule} onValueChange={v => update('halvedHoleRule', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_point">½ Point Each</SelectItem>
                  <SelectItem value="no_points">No Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Use Handicaps</Label>
            <Switch checked={data.useHandicaps} onCheckedChange={v => update('useHandicaps', v)} />
          </div>

          {data.useHandicaps && (
            <div>
              <Label>Handicap Allowance: {data.handicapAllowancePercent}%</Label>
              <Slider value={[data.handicapAllowancePercent]} onValueChange={v => update('handicapAllowancePercent', v[0])} min={0} max={100} step={5} className="mt-2" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Max Score Per Hole</Label>
            <Switch checked={data.maxScoreEnabled} onCheckedChange={v => update('maxScoreEnabled', v)} />
          </div>
          {data.maxScoreEnabled && (
            <div>
              <Label>Max strokes over par</Label>
              <Input type="number" value={data.maxScorePerHole} onChange={e => update('maxScorePerHole', parseInt(e.target.value) || 4)} min={1} max={10} />
            </div>
          )}

          {data.gameType === 'match_play_best_ball' && (
            <div className="flex items-center justify-between">
              <Label>Second Ball Tiebreaker</Label>
              <Switch checked={data.secondBallTiebreaker} onCheckedChange={v => update('secondBallTiebreaker', v)} />
            </div>
          )}

          {(data.gameType === 'match_play_gross_best_ball' || data.gameType === 'blind_gross_best_ball') && (
            <div className="flex items-start gap-2 bg-accent/50 rounded-lg p-3">
              <Info className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-accent-foreground">
                Holes 1–6: Best 2 of 4 gross scores • Holes 7–12: Best 3 of 4 • Holes 13–18: All 4 scores
              </p>
            </div>
          )}

          {data.gameType === 'tournament_sixes' && (
            <div className="space-y-3">
              <div>
                <Label>Sixes Format</Label>
                <Select value={data.sixesFormat} onValueChange={v => update('sixesFormat', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match_play">Match Play (per hole)</SelectItem>
                    <SelectItem value="sum_of_strokes">Sum of Strokes (per segment)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.sixesFormat === 'sum_of_strokes' && (
                <div className="grid grid-cols-3 gap-2">
                  {['Holes 1–6', 'Holes 7–12', 'Holes 13–18'].map((lbl, i) => (
                    <div key={i}>
                      <Label className="text-xs">{lbl} pts</Label>
                      <Input
                        type="number"
                        value={data.sixesSegmentPoints[i]}
                        onChange={e => {
                          const next = [...data.sixesSegmentPoints] as [number, number, number];
                          next[i] = parseFloat(e.target.value) || 1;
                          update('sixesSegmentPoints', next);
                        }}
                        min={0.5}
                        step={0.5}
                        className="h-8"
                      />
                    </div>
                  ))}
                </div>
              )}

              {['Holes 1–6', 'Holes 7–12', 'Holes 13–18'].map((label, i) => (
                <div key={i} className="bg-card rounded-lg p-3 space-y-2 border border-border">
                  <p className="text-sm font-medium">{label}</p>
                  <Input
                    value={data.sixesConfig[i]?.rules || ''}
                    onChange={e => {
                      const next = [...data.sixesConfig];
                      next[i] = { ...next[i], rules: e.target.value };
                      update('sixesConfig', next);
                    }}
                    placeholder="Rules for this segment..."
                  />
                  <Input
                    value={data.sixesConfig[i]?.formatNotes || ''}
                    onChange={e => {
                      const next = [...data.sixesConfig];
                      next[i] = { ...next[i], formatNotes: e.target.value };
                      update('sixesConfig', next);
                    }}
                    placeholder="Format notes..."
                  />
                </div>
              ))}
            </div>
          )}

          <Collapsible open={showHolePoints} onOpenChange={setShowHolePoints}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary">
              <ChevronDown className={`w-4 h-4 transition-transform ${showHolePoints ? 'rotate-180' : ''}`} />
              {holePointsCount ? 'Customize hole points' : 'Customize hole points (tiebreak only)'}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-6 gap-1.5">
                {data.holePointOverrides.map((pts, i) => (
                  <div key={i} className="text-center">
                    <span className="text-[10px] text-muted-foreground block">H{i + 1}</span>
                    <Input
                      type="number"
                      value={pts}
                      onChange={e => {
                        const next = [...data.holePointOverrides];
                        next[i] = parseFloat(e.target.value) || 1;
                        update('holePointOverrides', next);
                      }}
                      className="h-8 text-xs text-center px-1"
                      min={0}
                      step={0.5}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {showTeamScoring && (
        <div className="space-y-3 rounded-lg border border-[hsl(var(--brand-gold))]/40 bg-[hsl(var(--brand-gold))]/5 p-3">
          <div>
            <Label>Team Scoring for this Round</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                ['per_hole', 'Per Hole only'],
                ['per_round', 'Per Round only'],
                ['per_hole_and_round', 'Per Hole + Per Round'],
                ['fbo', 'Front / Back / Overall'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => update('teamScoringMode', mode)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    data.teamScoringMode === mode
                      ? 'border-[hsl(var(--brand-gold))] bg-[hsl(var(--brand-gold))]/20 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {data.teamScoringMode === 'per_hole' && (
            <p className="text-xs text-muted-foreground">
              This round contributes its hole-by-hole points ({data.defaultPointsPerHole} per hole, plus any hole overrides) to the team totals. No round-win bonus.
            </p>
          )}

          {data.teamScoringMode === 'per_hole_and_round' && (
            <p className="text-xs text-muted-foreground">
              Hole-by-hole points count toward the team totals, plus a bonus for winning the round.
            </p>
          )}

          {(data.teamScoringMode === 'per_round' || data.teamScoringMode === 'per_hole_and_round') && (
            <div>
              <Label className="text-xs">Points for winning this round</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={data.teamScoringPoints.round}
                onChange={e => updatePoints('round', Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-8 w-24 mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">A tied round splits this value in half.</p>
            </div>
          )}

          {data.teamScoringMode === 'fbo' && (
            <div>
              <div className="grid grid-cols-3 gap-2">
                {([['front', 'Front 9'], ['back', 'Back 9'], ['overall', 'Overall']] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs">{label} pts</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={data.teamScoringPoints[key]}
                      onChange={e => updatePoints(key, Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-8 mt-1"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Each tied segment splits its points in half.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoundConfigCard;
