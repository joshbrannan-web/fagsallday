import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Player } from '@/types';
import { DollarSign, ChevronRight, ChevronLeft } from 'lucide-react';

interface GreenFeeSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  onSkip: () => void;
  onConfirm: (adjustments: Record<string, number>, payerName: string, totalAmount: number, splitCount: number) => void;
}

const GreenFeeSplitDialog: React.FC<GreenFeeSplitDialogProps> = ({
  open,
  onOpenChange,
  players,
  onSkip,
  onConfirm,
}) => {
  const [step, setStep] = useState(1);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setPayerId(null);
      setTotalAmount('');
      setSelectedPlayerIds(new Set());
    }
  }, [open]);

  // When payer is selected, default all other players checked
  useEffect(() => {
    if (payerId) {
      setSelectedPlayerIds(new Set(players.filter(p => p.id !== payerId).map(p => p.id)));
    }
  }, [payerId, players]);

  const payer = players.find(p => p.id === payerId);
  const amount = parseFloat(totalAmount) || 0;
  const splitCount = selectedPlayerIds.size + 1; // includes payer
  const perPerson = splitCount > 0 ? Math.round((amount / splitCount) * 100) / 100 : 0;

  const handleConfirm = () => {
    if (!payerId || amount <= 0) return;
    const adjustments: Record<string, number> = {};
    // Each selected player owes perPerson (negative = they owe)
    selectedPlayerIds.forEach(id => {
      adjustments[id] = -perPerson;
    });
    // Payer is owed the total of others' shares (positive = they're owed)
    adjustments[payerId] = perPerson * selectedPlayerIds.size;
    onConfirm(adjustments, payer!.name, amount, splitCount);
    onOpenChange(false);
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Green Fee Split
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Include a green fee split in the results?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { onSkip(); onOpenChange(false); }}>
                No
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                Yes
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Who paid for the green fees?</p>
            <div className="space-y-2">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPayerId(p.id); setStep(3); }}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    payerId === p.id
                      ? 'border-primary bg-primary/10 font-semibold'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How much did {payer?.name} pay total?</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7 text-lg font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && amount > 0) setStep(4);
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setStep(4)} disabled={amount <= 0}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Split against which players?</p>
            <div className="space-y-2">
              {players.filter(p => p.id !== payerId).map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-all"
                >
                  <Checkbox
                    checked={selectedPlayerIds.has(p.id)}
                    onCheckedChange={() => togglePlayer(p.id)}
                  />
                  <span className="font-medium">{p.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep(3)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setStep(5)} disabled={selectedPlayerIds.size === 0}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-center">
                {payer?.name} paid ${amount.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Split {splitCount} ways — ${perPerson.toFixed(2)} each
              </p>
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                {players.filter(p => selectedPlayerIds.has(p.id)).map(p => (
                  <p key={p.id} className="text-sm flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-mono text-destructive">owes ${perPerson.toFixed(2)}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep(4)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button size="sm" className="flex-1" onClick={handleConfirm}>
                Confirm & Share
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GreenFeeSplitDialog;
