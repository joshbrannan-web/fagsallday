import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, Eye, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export const WHATS_NEW_VERSION = '2026-02-22';
const STORAGE_KEY = 'fg_whats_new_seen';

const updates = [
  {
    icon: Sparkles,
    title: 'GHIN Handicap Sync',
    description:
      'Link your GHIN number to automatically pull your handicap from USGA. One-way sync keeps your index current.',
  },
  {
    icon: Eye,
    title: 'Live Round Viewing',
    description:
      "If you're a linked player in someone else's round, you can now view the live scorecard in real-time from the home screen.",
  },
  {
    icon: Share2,
    title: 'Round Sharing',
    description:
      'Finished rounds are automatically shared with linked players so everyone can see results in their history.',
  },
];

const WhatsNewDialog: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem('fg_onboarding_complete') !== 'true') return;
    if (localStorage.getItem(STORAGE_KEY) === WHATS_NEW_VERSION) return;
    setOpen(true);
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>What's New 🎉</DialogTitle>
          <DialogDescription>
            Here's what we've been working on recently.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-2">
            {updates.map((item) => (
              <div key={item.title} className="flex gap-3 items-start">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full">Got It</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewDialog;
