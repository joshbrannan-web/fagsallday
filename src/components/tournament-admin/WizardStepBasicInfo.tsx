import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface BasicInfoData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  numRounds: number;
  teamScoringMethod: 'cumulative' | 'round_win';
}

interface Props {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
}

const WizardStepBasicInfo: React.FC<Props> = ({ data, onChange }) => {
  const update = (key: keyof BasicInfoData, value: any) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="name">Tournament Name *</Label>
        <Input id="name" value={data.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Ryder Cup 2025" />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <textarea
          id="desc"
          value={data.description}
          onChange={e => update('description', e.target.value.slice(0, 300))}
          placeholder="Optional description..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
          maxLength={300}
        />
        <p className="text-xs text-muted-foreground text-right mt-1">{data.description.length}/300</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start">Start Date *</Label>
          <Input id="start" type="date" value={data.startDate} onChange={e => update('startDate', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="end">End Date *</Label>
          <Input id="end" type="date" value={data.endDate} onChange={e => update('endDate', e.target.value)} min={data.startDate} />
        </div>
      </div>
      <div>
        <Label>Number of Rounds</Label>
        <div className="flex items-center gap-3 mt-1">
          <Button type="button" variant="outline" size="icon" onClick={() => update('numRounds', Math.max(1, data.numRounds - 1))} disabled={data.numRounds <= 1}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-lg font-bold w-8 text-center">{data.numRounds}</span>
          <Button type="button" variant="outline" size="icon" onClick={() => update('numRounds', Math.min(10, data.numRounds + 1))} disabled={data.numRounds >= 10}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Label>Team Scoring</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-sm space-y-2 max-w-xs">
              <p><strong>Cumulative Points:</strong> Every hole's points add up across all rounds to form the grand total.</p>
              <p><strong>Round Win (1pt):</strong> Each completed round awards 1 point to the winning team. Tied rounds award ½ point each.</p>
            </PopoverContent>
          </Popover>
        </div>
        <Select value={data.teamScoringMethod} onValueChange={v => update('teamScoringMethod', v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cumulative">Cumulative Points</SelectItem>
            <SelectItem value="round_win">Round Win (1pt)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default WizardStepBasicInfo;
