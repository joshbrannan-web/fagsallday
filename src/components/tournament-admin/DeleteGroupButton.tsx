import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  groupId?: string;
  groupNumber?: number | string;
  tournamentId?: string;
}

const DeleteGroupButton: React.FC<Props> = ({ groupId, groupNumber, tournamentId }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!groupId) return;
    setDeleting(true);
    try {
      await supabase.from('tournament_hole_results').delete().eq('tournament_group_id', groupId);
      await supabase.from('tournament_hole_scores').delete().eq('tournament_group_id', groupId);
      await supabase.from('tournament_group_players').delete().eq('tournament_group_id', groupId);
      await supabase.from('tournament_groups').delete().eq('id', groupId);
      toast.success('Group round deleted');
      navigate(`/tournament-admin/${tournamentId}`);
    } catch {
      toast.error('Failed to delete group data');
    }
    setDeleting(false);
  };

  return (
    <>
      <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-destructive">Danger Zone</p>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setOpen(true)}
          disabled={deleting}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete Group Round
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group Round?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all scores, results, and player assignments for Group {groupNumber || '?'}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DeleteGroupButton;
