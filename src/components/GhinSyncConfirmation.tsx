import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GhinSyncConfirmationProps {
  open: boolean;
  onClose: () => void;
}

const GhinSyncConfirmation: React.FC<GhinSyncConfirmationProps> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Great, Your GHIN is Synced!</DialogTitle>
        <DialogDescription>
          This is a 1-way sync that will pull your updated Handicap from USGA. It does NOT send data or Round info to USGA.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={onClose} className="w-full">Got It</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default GhinSyncConfirmation;
