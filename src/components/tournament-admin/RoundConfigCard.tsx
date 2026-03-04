import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Info } from 'lucide-react';
import type { TournamentGameType } from '@/types/tournament';
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
  sixesFormat: 'match_play' | 'sum_of_strokes';
  sixesSegmentPoints: [number, number, number];
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
  sixesFormat: 'match_play',
  sixesSegmentPoints: [1, 1, 1],
});

interface Props {
  data: RoundConfigData;
  onChange: (data: RoundConfigData) => void;
  roundNumber: number;
}

const RoundConfigCard: React.FC<Props> = ({ data, onChange, roundNumber }) => {
  const [showHolePoints, setShowHolePoints] = useState(false);
  const update = (key: keyof RoundConfigData, value: any) => onChange({ ...data, [key]: value });

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
        <Select value={data.gameType} onValueChange={v => update('gameType', v)}>
          <SelectTrigger><SelectValue placeholder="Select game type..." /></SelectTrigger>
          <SelectContent>
            {GAME_TYPES.map(g => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.gameType && (
        <div className="space-y-4 bg-muted/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Points Per Hole</Label>
              <Input type="number" value={data.defaultPointsPerHole} onChange={e => update('defaultPointsPerHole', parseFloat(e.target.value) || 1)} min={0.5} step={0.5} />
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
              Customize hole points
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
    </div>
  );
};

export default RoundConfigCard;
