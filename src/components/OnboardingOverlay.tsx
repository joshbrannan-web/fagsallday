import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flag, MapPin, Trophy, DollarSign, ChevronRight, ChevronLeft } from 'lucide-react';

const STORAGE_KEY = 'fg_onboarding_complete';

const steps = [
  {
    icon: <Flag className="w-10 h-10 text-primary" />,
    title: "Welcome to F&Gs All Day",
    description: "Your all-in-one golf scoring and betting companion. Track scores, run games, and settle up — all from your phone.",
  },
  {
    icon: <MapPin className="w-10 h-10 text-primary" />,
    title: "Pick a Course",
    description: "Search any course by name, scan a scorecard with your camera, or choose from your saved favorites. Hole data loads automatically.",
  },
  {
    icon: <Trophy className="w-10 h-10 text-primary" />,
    title: "Choose Your Games",
    games: [
      { icon: "🏦", name: "Banker", desc: "One player banks each hole" },
      { icon: "🎯", name: "Skins", desc: "Lowest score wins the pot" },
      { icon: "🎱", name: "FBO", desc: "Front, Back & Overall dots" },
      { icon: "🎲", name: "6's / 3's", desc: "2v2 team match play" },
      { icon: "🐺", name: "Wolf", desc: "Pick a partner or go solo" },
      { icon: "6️⃣", name: "Stockton 6's", desc: "Nassau with dots & presses" },
    ],
  },
  {
    icon: <DollarSign className="w-10 h-10 text-primary" />,
    title: "Track & Settle",
    description: "Scores auto-calculate net results, multipliers, and payouts. When you're done, see who owes who — no math required.",
  },
];

interface OnboardingOverlayProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ forceOpen, onClose }) => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
    onClose?.();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const step = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {step.icon}
          </div>
          <h2 className="text-xl font-bold">{step.title}</h2>
          
          {step.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          )}
          
          {step.games && (
            <div className="w-full grid grid-cols-2 gap-2 text-left">
              {step.games.map(g => (
                <div key={g.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">{g.icon}</span>
                  <div>
                    <div className="text-xs font-semibold">{g.name}</div>
                    <div className="text-[10px] text-muted-foreground">{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="p-4 pt-0 space-y-3">
          {/* Dot indicator */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 ? (
              <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
                Skip
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="flex-1 gap-1">
              {currentStep === steps.length - 1 ? "Let's Go!" : "Next"}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingOverlay;
