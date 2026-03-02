import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

const PRESET_COLORS = [
  '#1d4ed8', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2',
  '#e11d48', '#7c3aed', '#059669', '#d97706', '#4f46e5', '#0d9488',
  '#be123c', '#6d28d9', '#15803d', '#b45309',
];

export interface TeamData {
  name: string;
  color: string;
}

interface Props {
  teams: TeamData[];
  onChange: (teams: TeamData[]) => void;
}

const WizardStepTeams: React.FC<Props> = ({ teams, onChange }) => {
  const updateTeam = (idx: number, key: keyof TeamData, value: string) => {
    const next = [...teams];
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };
  const addTeam = () => onChange([...teams, { name: `Team ${String.fromCharCode(65 + teams.length)}`, color: PRESET_COLORS[teams.length % PRESET_COLORS.length] }]);
  const removeTeam = (idx: number) => onChange(teams.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Create the competing teams (e.g. Team USA vs Team Europe)</p>
      {teams.map((team, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="relative">
            <input
              type="color"
              value={team.color}
              onChange={e => updateTeam(idx, 'color', e.target.value)}
              className="w-10 h-10 rounded-lg border border-input cursor-pointer p-0.5"
            />
          </div>
          <Input
            value={team.name}
            onChange={e => updateTeam(idx, 'name', e.target.value)}
            placeholder="Team name"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeTeam(idx)}
            disabled={teams.length <= 2}
            className="text-muted-foreground"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addTeam} className="w-full">
        <Plus className="w-4 h-4 mr-1" /> Add Team
      </Button>
    </div>
  );
};

export default WizardStepTeams;
