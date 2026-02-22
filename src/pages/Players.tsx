import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSavedPlayers, SavedPlayer } from '@/hooks/useSavedPlayers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Edit2, Check, X, Loader2, UserPlus, Users, UserCheck, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import UserSearchDialog from '@/components/UserSearchDialog';

const Players: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { savedPlayers, isLoading: playersLoading, addPlayer, updatePlayer, deletePlayer } = useSavedPlayers();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [editTee, setEditTee] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHandicap, setNewHandicap] = useState('');
  const [newTee, setNewTee] = useState('White');

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null);
  const [newPlayerLinkUserId, setNewPlayerLinkUserId] = useState<string | null>(null);
  const [newPlayerLinkName, setNewPlayerLinkName] = useState<string | null>(null);
  const [showNewPlayerLinkDialog, setShowNewPlayerLinkDialog] = useState(false);

  const isLoading = authLoading || playersLoading;

  const handleStartEdit = (player: SavedPlayer) => {
    setEditingId(player.id);
    setEditName(player.name);
    setEditHandicap(player.handicap_index.toString());
    setEditTee(player.tee);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditHandicap('');
    setEditTee('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) {
      toast.error('Name is required');
      return;
    }

    const success = await updatePlayer(editingId, {
      name: editName.trim(),
      handicap_index: parseFloat(editHandicap) || 0,
      tee: editTee || 'White'
    });

    if (success) {
      toast.success('Player updated');
      handleCancelEdit();
    }
  };

  const handleAddPlayer = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }

    const result = await addPlayer(newName.trim(), parseFloat(newHandicap) || 0, newTee || 'White', newPlayerLinkUserId);
    if (result) {
      setShowAddForm(false);
      setNewName('');
      setNewHandicap('');
      setNewTee('White');
      setNewPlayerLinkUserId(null);
      setNewPlayerLinkName(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePlayer(id);
  };

  const handleLinkUser = (playerId: string) => {
    setLinkingPlayerId(playerId);
    setLinkDialogOpen(true);
  };

  const handleUnlinkUser = async (playerId: string) => {
    const success = await updatePlayer(playerId, { linked_user_id: null });
    if (success) {
      toast.success('User unlinked');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Users className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">Sign in to manage players</h1>
        <p className="text-muted-foreground mb-6">
          Create an account to save your playing partners for future rounds.
        </p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">My Players</h1>
          <p className="text-sm text-muted-foreground">{savedPlayers.length} saved players</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Add Player Form */}
        {showAddForm && (
          <div className="bg-card rounded-xl border border-primary p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">New Player</span>
              <button
                onClick={() => { setShowAddForm(false); setNewPlayerLinkUserId(null); setNewPlayerLinkName(null); }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="newName">Name</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Player name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="newHandicap">Handicap</Label>
                <Input
                  id="newHandicap"
                  type="number"
                  step="0.1"
                  value={newHandicap}
                  onChange={(e) => setNewHandicap(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="newTee">Preferred Tee</Label>
              <Input
                id="newTee"
                value={newTee}
                onChange={(e) => setNewTee(e.target.value)}
                placeholder="White"
                className="mt-1"
              />
            </div>
            {/* Link to User */}
            <div>
              {newPlayerLinkName ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <UserCheck className="w-3 h-3" />
                    Linked to {newPlayerLinkName}
                  </Badge>
                  <button
                    onClick={() => { setNewPlayerLinkUserId(null); setNewPlayerLinkName(null); }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPlayerLinkDialog(true)}
                  className="gap-2"
                >
                  <Link2 className="w-3 h-3" />
                  Link to App User
                </Button>
              )}
            </div>
            <Button onClick={handleAddPlayer} className="w-full">
              Save Player
            </Button>
          </div>
        )}

        {/* Empty State */}
        {savedPlayers.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No saved players yet</h2>
            <p className="text-muted-foreground mb-6">
              Players will be automatically saved when you start a round.
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Player Manually
            </Button>
          </div>
        )}

        {/* Player List */}
        {savedPlayers.map((player) => (
          <div
            key={player.id}
            className="bg-card rounded-xl border border-border p-4 space-y-3 animate-fade-in"
          >
            {editingId === player.id ? (
              // Edit Mode
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Handicap</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editHandicap}
                      onChange={(e) => setEditHandicap(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Preferred Tee</Label>
                  <Input
                    value={editTee}
                    onChange={(e) => setEditTee(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} size="sm" className="flex-1 gap-2">
                    <Check className="w-4 h-4" />
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} variant="outline" size="sm" className="flex-1 gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              // View Mode
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {player.name}
                    {player.linked_user_id && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                        <UserCheck className="w-3 h-3" /> Linked
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Handicap: {player.handicap_index} • Tee: {player.tee}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!player.linked_user_id ? (
                    <button
                      onClick={() => handleLinkUser(player.id)}
                      className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                      title="Link to app user"
                    >
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnlinkUser(player.id)}
                      className="p-2 hover:bg-destructive/10 rounded-full transition-colors"
                      title="Unlink user"
                    >
                      <UserCheck className="w-4 h-4 text-primary" />
                    </button>
                  )}
                  <button
                    onClick={() => handleStartEdit(player)}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 hover:bg-destructive/10 rounded-full transition-colors">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {player.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove this player from your saved players. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(player.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Link to User Dialog - for existing players */}
      <UserSearchDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onSelect={async (selectedUser) => {
          if (linkingPlayerId) {
            const success = await updatePlayer(linkingPlayerId, { linked_user_id: selectedUser.id });
            if (success) {
              toast.success(`Linked to ${selectedUser.display_name}`);
            }
            setLinkingPlayerId(null);
          }
        }}
      />

      {/* Link to User Dialog - for new player form */}
      <UserSearchDialog
        open={showNewPlayerLinkDialog}
        onOpenChange={setShowNewPlayerLinkDialog}
        onSelect={(selectedUser) => {
          setNewPlayerLinkUserId(selectedUser.id);
          setNewPlayerLinkName(selectedUser.display_name);
          if (!newName.trim()) {
            setNewName(selectedUser.display_name || '');
          }
        }}
      />
    </div>
  );
};

export default Players;
