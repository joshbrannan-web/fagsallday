import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Edit2, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';

const SB_TYPES = [
  { value: 'team_points', label: 'Team Points' },
  { value: 'individual_gross', label: 'Individual Gross Scores' },
  { value: 'individual_net', label: 'Individual Net Scores' },
  { value: 'individual_points', label: 'Individual Points Won' },
  { value: 'team_round_result', label: 'Team Round Result' },
  { value: 'individual_round_result', label: 'Individual Round Result' },
  { value: 'group_matches', label: 'Live Group Matches' },
];

const SORT_METRICS = [
  { value: 'total_points', label: 'Total Points' },
  { value: 'gross_score', label: 'Gross Score' },
  { value: 'net_score', label: 'Net Score' },
  { value: 'wins', label: 'Wins' },
];

interface Props {
  scoreboards: any[];
  onAdd: (data: any) => Promise<void>;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ScoreboardManager: React.FC<Props> = ({ scoreboards, onAdd, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', scoreboard_type: 'team_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true });

  const openNew = () => {
    setForm({ name: '', scoreboard_type: 'team_points', sort_metric: 'total_points', sort_direction: 'desc', show_round_breakdown: true });
    setEditing('new');
  };

  const openEdit = (sb: any) => {
    setForm({
      name: sb.name,
      scoreboard_type: sb.scoreboard_type,
      sort_metric: sb.sort_metric,
      sort_direction: sb.sort_direction || 'desc',
      show_round_breakdown: sb.show_round_breakdown ?? true,
    });
    setEditing(sb);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing === 'new') await onAdd(form);
    else await onUpdate(editing.id, form);
    setEditing(null);
  };

  const sorted = [...scoreboards].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const handleSwap = async (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[targetIdx];
    const aOrder = a.display_order ?? idx;
    const bOrder = b.display_order ?? targetIdx;
    await onUpdate(a.id, { display_order: bOrder });
    await onUpdate(b.id, { display_order: aOrder });
  };

  return (
    <div className="space-y-3">
      {sorted.map((sb: any, idx: number) => (
        <Card key={sb.id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => handleSwap(idx, 'up')}>
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sorted.length - 1} onClick={() => handleSwap(idx, 'down')}>
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div>
              <p className="font-medium text-sm">{sb.name}</p>
              <p className="text-xs text-muted-foreground">
                {SB_TYPES.find(t => t.value === sb.scoreboard_type)?.label} • {sb.sort_direction === 'desc' ? 'High → Low' : 'Low → High'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sb)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(sb.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={openNew}>
        <Plus className="w-4 h-4 mr-1" /> Add Scoreboard
      </Button>

      <Sheet open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing === 'new' ? 'New Scoreboard' : 'Edit Scoreboard'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Team Race" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.scoreboard_type} onValueChange={v => setForm(f => ({ ...f, scoreboard_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SB_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Metric</Label>
              <Select value={form.sort_metric} onValueChange={v => setForm(f => ({ ...f, sort_metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Direction</Label>
              <Select value={form.sort_direction} onValueChange={v => setForm(f => ({ ...f, sort_direction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High → Low</SelectItem>
                  <SelectItem value="asc">Low → High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Round Breakdown</Label>
              <Switch checked={form.show_round_breakdown} onCheckedChange={v => setForm(f => ({ ...f, show_round_breakdown: v }))} />
            </div>
            <Button className="w-full" onClick={handleSave}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ScoreboardManager;
