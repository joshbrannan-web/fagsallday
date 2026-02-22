import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const DISMISSED_KEY = 'fg_ghin_prompt_dismissed';

const GhinPrompt: React.FC = () => {
  const { profile, updateProfile, isLoading: authLoading } = useAuth();
  const [showGhinDialog, setShowGhinDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [ghinNumber, setGhinNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.ghin_number) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setShowGhinDialog(true);
  }, [authLoading, profile]);

  const handleLinkGhin = async () => {
    if (!/^\d{5,9}$/.test(ghinNumber)) {
      toast.error('GHIN number must be 5-9 digits');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-ghin-handicap', {
        body: { ghin_number: ghinNumber, update_profile: true },
      });

      if (error || !data) {
        toast.error(data?.error || 'Failed to link GHIN number');
        return;
      }

      await updateProfile({
        ghin_number: ghinNumber,
        handicap_index: data.handicap_index,
        ghin_last_synced: new Date().toISOString(),
      });

      toast.success(`GHIN linked! Handicap: ${data.handicap_index}`);
      setShowGhinDialog(false);
    } catch {
      toast.error('Failed to link GHIN number');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowGhinDialog(false);
    setShowInfoDialog(true);
  };

  const handleGotIt = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setShowInfoDialog(false);
  };

  return (
    <>
      {/* GHIN Entry Dialog */}
      <Dialog open={showGhinDialog} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Link Your USGA GHIN</DialogTitle>
            <DialogDescription>
              Enter your GHIN number to automatically sync your handicap index.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ghin-number">GHIN Number</Label>
              <Input
                id="ghin-number"
                placeholder="e.g. 1234567"
                value={ghinNumber}
                onChange={(e) => setGhinNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button onClick={handleLinkGhin} disabled={isLoading || !ghinNumber}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link GHIN
            </Button>
            <Button variant="outline" onClick={handleDismiss} disabled={isLoading}>
              Dismiss, No GHIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={(open) => { if (!open) handleGotIt(); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>No Problem!</DialogTitle>
            <DialogDescription>
              You can always add your GHIN later by selecting <strong>Edit Profile</strong> from the menu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleGotIt} className="w-full">Got It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GhinPrompt;
