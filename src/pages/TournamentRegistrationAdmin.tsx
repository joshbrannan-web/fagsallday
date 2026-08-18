import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournaments } from '@/hooks/useTournaments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Copy, ExternalLink, Plus, Users, Link as LinkIcon, Unplug, Trash2, RefreshCw, Pencil } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import RegistrationConfigForm from '@/components/tournament-admin/RegistrationConfigForm';
import RegistrationEntryList from '@/components/tournament-admin/RegistrationEntryList';

const TournamentRegistrationAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { configId } = useParams<{ configId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const { tournaments } = useTournaments();

  const [configs, setConfigs] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [processingEntryId, setProcessingEntryId] = useState<string | null>(null);
  const [configToDelete, setConfigToDelete] = useState<any>(null);
  const [deletingConfig, setDeletingConfig] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<any>(null);
  const [pendingTournamentChange, setPendingTournamentChange] = useState<{ newId: string | null; approvedCount: number; oldName: string; newName: string } | null>(null);
  const [relinking, setRelinking] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [backfillingHcp, setBackfillingHcp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);


  const handleDeleteConfig = async () => {
    if (!configToDelete) return;
    setDeletingConfig(true);
    try {
      const { error } = await supabase.functions.invoke('delete-registration-config', {
        body: { config_id: configToDelete.id },
      });
      if (error) throw error;
      setConfigs(prev => prev.filter(c => c.id !== configToDelete.id));
      toast.success(`"${configToDelete.name}" deleted`);
      setConfigToDelete(null);
    } catch (err: any) {
      console.error('Delete config error:', err);
      toast.error('Failed to delete registration');
    } finally {
      setDeletingConfig(false);
    }
  };

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin, navigate]);

  useEffect(() => {
    if (!user) return;
    loadConfigs();
  }, [user]);

  useEffect(() => {
    if (configId) {
      loadEntries(configId);
      const cfg = configs.find(c => c.id === configId);
      setSelectedConfig(cfg || null);
    } else {
      setSelectedConfig(null);
      setEntries([]);
    }
  }, [configId, configs]);

  useEffect(() => {
    if (!configId && searchParams.get('new') === '1') {
      setShowCreateForm(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [configId, searchParams, setSearchParams]);

  const loadConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tournament_registration_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error loading configs:', error);
    setConfigs(data || []);
    setLoading(false);
  };

  const loadEntries = async (cfgId: string) => {
    setEntriesLoading(true);
    const { data, error } = await supabase
      .from('tournament_registration_entries')
      .select('*')
      .eq('config_id', cfgId)
      .order('created_at', { ascending: false });

    if (error) console.error('Error loading entries:', error);
    setEntries(data || []);
    setEntriesLoading(false);
  };

  const handleCreate = async (formData: any) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('tournament_registration_configs')
        .insert({
          created_by: user.id,
          name: formData.name,
          description: formData.description || null,
          location: formData.location,
          event_dates: formData.event_dates,
          payment_required: formData.payment_required,
          amount: formData.amount,
          amount_label: formData.amount_label,
          venmo_link: formData.venmo_link,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Registration page created!');
      setShowCreateForm(false);
      await loadConfigs();
      if (data) navigate(`/tournament-admin/registrations/${data.id}`);
    } catch (err: any) {
      console.error('Create error:', err);
      toast.error('Failed to create registration page');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateConfig = async (formData: any) => {
    if (!selectedConfig) return;
    setIsSubmitting(true);
    try {
      const patch = {
        name: formData.name,
        description: formData.description || null,
        location: formData.location,
        event_dates: formData.event_dates,
        payment_required: formData.payment_required,
        amount: formData.amount,
        amount_label: formData.amount_label,
        venmo_link: formData.venmo_link,
      };
      const { error } = await supabase
        .from('tournament_registration_configs')
        .update(patch)
        .eq('id', selectedConfig.id);
      if (error) throw error;

      const updated = { ...selectedConfig, ...patch };
      setSelectedConfig(updated);
      setConfigs(prev => prev.map(c => (c.id === updated.id ? { ...c, ...patch } : c)));
      setIsEditing(false);
      toast.success('Registration updated');
    } catch (err: any) {
      console.error('Update config error:', err);
      toast.error('Failed to update registration');
    } finally {
      setIsSubmitting(false);
    }
  };


  const toggleOpen = async (cfgId: string, currentlyOpen: boolean) => {
    const { error } = await supabase
      .from('tournament_registration_configs')
      .update({ is_open: !currentlyOpen })
      .eq('id', cfgId);

    if (error) {
      toast.error('Failed to update');
    } else {
      setConfigs(prev => prev.map(c => c.id === cfgId ? { ...c, is_open: !currentlyOpen } : c));
      toast.success(currentlyOpen ? 'Registration closed' : 'Registration opened');
    }
  };

  const assignTournament = async (cfgId: string, tournamentId: string) => {
    const newId = tournamentId === 'none' ? null : tournamentId;
    const oldId = selectedConfig?.tournament_id ?? null;
    if (newId === oldId) return;

    const approvedCount = entries.filter(e => e.status === 'approved').length;
    const oldName = tournaments.find(t => t.id === oldId)?.name || 'None';
    const newName = tournaments.find(t => t.id === newId)?.name || 'None';

    // Block changes when either tournament is live
    const oldT = tournaments.find(t => t.id === oldId);
    const newT = tournaments.find(t => t.id === newId);
    if (oldT?.status === 'active') {
      toast.error('Cannot change linked tournament while it is live');
      return;
    }
    if (newT?.status === 'active') {
      toast.error('Cannot link to a tournament that is already live');
      return;
    }

    // If no approved entries, just update directly (no player movement needed)
    if (approvedCount === 0) {
      const { error } = await supabase
        .from('tournament_registration_configs')
        .update({ tournament_id: newId })
        .eq('id', cfgId);
      if (error) {
        toast.error('Failed to link tournament');
      } else {
        setConfigs(prev => prev.map(c => c.id === cfgId ? { ...c, tournament_id: newId } : c));
        setSelectedConfig((c: any) => c ? { ...c, tournament_id: newId } : c);
        toast.success('Tournament linked');
      }
      return;
    }

    // Otherwise confirm and move approved players
    setPendingTournamentChange({ newId, approvedCount, oldName, newName });
  };

  const confirmRelink = async () => {
    if (!pendingTournamentChange || !selectedConfig) return;
    setRelinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('relink-registration-tournament', {
        body: { config_id: selectedConfig.id, new_tournament_id: pendingTournamentChange.newId },
      });
      if (error) throw error;
      const newId = pendingTournamentChange.newId;
      setConfigs(prev => prev.map(c => c.id === selectedConfig.id ? { ...c, tournament_id: newId } : c));
      setSelectedConfig((c: any) => c ? { ...c, tournament_id: newId } : c);
      toast.success(`Moved ${data?.added ?? 0} player(s) to ${pendingTournamentChange.newName}`);
      setPendingTournamentChange(null);
    } catch (err: any) {
      console.error('Relink error:', err);
      toast.error(err?.message || 'Failed to change linked tournament');
    } finally {
      setRelinking(false);
    }
  };

  const handleSyncAllApproved = async () => {
    if (!selectedConfig?.tournament_id) return;
    setSyncingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-approved-to-tournament', {
        body: { config_id: selectedConfig.id },
      });
      if (error) throw error;
      toast.success(`Added ${data?.added ?? 0} player(s), ${data?.skipped ?? 0} already present`);
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Failed to sync approved registrants');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleBackfillHandicaps = async () => {
    if (!selectedConfig) return;
    setBackfillingHcp(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-registration-handicaps', {
        body: { config_id: selectedConfig.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const failed = data?.failed?.length ?? 0;
      toast.success(
        `Updated ${data?.updated ?? 0} handicap(s)${failed ? `, ${failed} GHIN(s) not found` : ''}`,
      );
      await loadEntries(selectedConfig.id);
    } catch (err: any) {
      console.error('Handicap backfill error:', err);
      toast.error(err?.message || 'Failed to fetch handicaps');
    } finally {
      setBackfillingHcp(false);
    }
  };



  const copyShareLink = (shareCode: string) => {
    const url = `https://fagsallday.com/#/register/${shareCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const handleConnectGoogle = () => {
    if (!selectedConfig) return;
    const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      toast.error('Google OAuth not configured');
      return;
    }
    const redirectUri = window.location.origin;
    const state = btoa(JSON.stringify({ config_id: selectedConfig.id }));
    const scopes = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;
    window.location.href = url;
  };

  const handleApprove = async (entry: any) => {
    setProcessingEntryId(entry.id);
    try {
      const { error } = await supabase.functions.invoke('approve-registration', {
        body: { entry_id: entry.id, action: 'approve' },
      });
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'approved' } : e));
      toast.success(`${entry.full_name} approved and added to tournament`);
    } catch (err: any) {
      console.error('Approve error:', err);
      toast.error('Failed to approve registration');
    } finally {
      setProcessingEntryId(null);
    }
  };

  const handleReject = async (entry: any) => {
    setProcessingEntryId(entry.id);
    try {
      const { error } = await supabase.functions.invoke('approve-registration', {
        body: { entry_id: entry.id, action: 'reject' },
      });
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'rejected' } : e));
      toast.success(`${entry.full_name}'s registration rejected`);
    } catch (err: any) {
      console.error('Reject error:', err);
      toast.error('Failed to reject registration');
    } finally {
      setProcessingEntryId(null);
    }
  };

  const handleDelete = async (entry: any) => {
    const linked = !!selectedConfig?.tournament_id;
    if (entry.status === 'approved' && linked) {
      setEntryToDelete(entry);
      return;
    }
    if (!confirm(`Delete ${entry.full_name}'s registration? This cannot be undone.`)) return;
    await performDelete(entry, 'entry_only');
  };

  const performDelete = async (entry: any, mode: 'entry_only' | 'entry_and_tournament') => {
    setProcessingEntryId(entry.id);
    try {
      const { error } = await supabase.functions.invoke('delete-registration', {
        body: { entry_id: entry.id, mode },
      });
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      toast.success(
        mode === 'entry_and_tournament'
          ? `${entry.full_name} removed from tournament and registration`
          : `${entry.full_name}'s registration deleted`
      );
      setEntryToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('Failed to delete registration');
    } finally {
      setProcessingEntryId(null);
    }
  };

  const handleSyncToSheet = async (entry: any) => {
    if (!selectedConfig?.id) return;
    setProcessingEntryId(entry.id);
    try {
      const { data, error } = await supabase.functions.invoke('sync-registration-to-sheets', {
        body: { config_id: selectedConfig.id, entry_id: entry.id },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.error(data.reason || 'Sheet sync skipped');
      } else {
        toast.success(`${entry.full_name} added to Google Sheet`);
      }
    } catch (err: any) {
      console.error('Sheet sync error:', err);
      toast.error('Failed to sync to Google Sheet');
    } finally {
      setProcessingEntryId(null);
    }
  };



  const handleUpdateHandicap = async (entry: any, value: number | null) => {
    setProcessingEntryId(entry.id);
    try {
      const { error } = await supabase
        .from('tournament_registration_entries')
        .update({ handicap_index: value })
        .eq('id', entry.id);
      if (error) throw error;

      if (entry.user_id && value != null) {
        await supabase.from('profiles').update({ handicap_index: value }).eq('id', entry.user_id);
      }

      setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, handicap_index: value } : e)));

      if (selectedConfig?.google_sheet_id) {
        await supabase.functions.invoke('sync-registration-to-sheets', {
          body: { config_id: selectedConfig.id, entry_id: entry.id },
        });
      }
      toast.success('Handicap updated');
    } catch (err: any) {
      console.error('Handicap update error:', err);
      toast.error('Failed to update handicap');
    } finally {
      setProcessingEntryId(null);
    }
  };

  const handleCreateSheet = async () => {
    if (!user || !selectedConfig) return;
    setCreatingSheet(true);
    try {
      const { data: sheetData, error: sheetError } = await supabase.functions.invoke(
        'create-registration-sheet',
        { body: { title: selectedConfig.name, config_id: selectedConfig.id } }
      );
      if (sheetError || !sheetData?.sheet_id) throw sheetError || new Error('No sheet returned');

      const updated = { ...selectedConfig, google_sheet_id: sheetData.sheet_id, google_sheet_url: sheetData.sheet_url };
      setSelectedConfig(updated);
      setConfigs(prev => prev.map(c => c.id === selectedConfig.id ? updated : c));
      toast.success('Google Sheet created!');
    } catch (err: any) {
      console.error('Sheet creation error:', err);
      toast.error('Failed to create Google Sheet');
    } finally {
      setCreatingSheet(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isTournamentAdmin) return null;

  // Detail view
  if (configId && selectedConfig) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24 animate-fade-in">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tournament-admin/registrations')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold flex-1">{selectedConfig.name}</h1>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(v => !v)}>
              <Pencil className="w-4 h-4 mr-1" /> {isEditing ? 'Close' : 'Edit Details'}
            </Button>
            <Badge variant={selectedConfig.is_open ? 'default' : 'secondary'}>
              {selectedConfig.is_open ? 'Open' : 'Closed'}
            </Badge>
          </div>

          {isEditing && (
            <RegistrationConfigForm
              mode="edit"
              isSubmitting={isSubmitting}
              onSubmit={handleUpdateConfig}
              onCancel={() => setIsEditing(false)}
              initialValues={{
                name: selectedConfig.name || '',
                description: selectedConfig.description || '',
                location: selectedConfig.location || '',
                event_dates: selectedConfig.event_dates || '',
                payment_required: selectedConfig.payment_required !== false,
                amount: selectedConfig.amount,
                amount_label: selectedConfig.amount_label,
                venmo_link: selectedConfig.venmo_link,
              }}
            />
          )}

          {/* Share link */}
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <code className="text-sm flex-1 truncate">
                https://fagsallday.com/#/register/{selectedConfig.share_code}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyShareLink(selectedConfig.share_code)}>
                <Copy className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>


          {/* Controls */}
          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Registration Open</span>
                <Switch
                  checked={selectedConfig.is_open}
                  onCheckedChange={() => toggleOpen(selectedConfig.id, selectedConfig.is_open)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Link to Tournament</span>
                <Select
                  value={selectedConfig.tournament_id || 'none'}
                  onValueChange={(v) => assignTournament(selectedConfig.id, v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select tournament..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tournaments.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedConfig.tournament_id && entries.some(e => e.status === 'approved') && (
                  <Button variant="outline" size="sm" onClick={handleSyncAllApproved} disabled={syncingAll}>
                    <Users className="w-4 h-4 mr-2" />
                    {syncingAll ? 'Syncing…' : 'Sync all approved to tournament'}
                  </Button>
                )}
                {!selectedConfig.tournament_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/tournament-admin/create?linkConfigId=${selectedConfig.id}`)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create Tournament
                  </Button>
                )}
                {entries.some(e => e.ghin_number && e.handicap_index == null) && (
                  <Button variant="outline" size="sm" onClick={handleBackfillHandicaps} disabled={backfillingHcp}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${backfillingHcp ? 'animate-spin' : ''}`} />
                    {backfillingHcp ? 'Fetching…' : 'Fetch missing GHIN handicaps'}
                  </Button>
                )}
              </div>


              {selectedConfig.google_sheet_url ? (
                <Button asChild variant="outline" size="sm">
                  <a href={selectedConfig.google_sheet_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open Google Sheet
                  </a>
                </Button>
              ) : selectedConfig.google_refresh_token ? (
                <Button variant="outline" size="sm" onClick={handleCreateSheet} disabled={creatingSheet}>
                  <Plus className="w-4 h-4 mr-2" /> {creatingSheet ? 'Creating…' : 'Create Google Sheet'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleConnectGoogle}>
                  <Unplug className="w-4 h-4 mr-2" /> Connect Google Sheets
                </Button>
              )}
            </CardContent>
          </Card>

          <RegistrationEntryList
            entries={entries}
            isLoading={entriesLoading}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            onSyncToSheet={selectedConfig?.google_sheet_id ? handleSyncToSheet : undefined}
            processingId={processingEntryId}
          />

        </div>

        {/* Relink tournament confirmation */}
        <AlertDialog open={!!pendingTournamentChange} onOpenChange={(open) => !open && !relinking && setPendingTournamentChange(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move approved registrants?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingTournamentChange?.approvedCount} approved registrant(s) will be removed from{' '}
                <strong>{pendingTournamentChange?.oldName}</strong> and added to{' '}
                <strong>{pendingTournamentChange?.newName}</strong>. Any team, group, and score data in the
                previous tournament will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={relinking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmRelink(); }}
                disabled={relinking}
              >
                {relinking ? 'Moving…' : 'Move registrants'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete approved entry — choose mode */}
        <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && !processingEntryId && setEntryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {entryToDelete?.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This registrant is approved and linked to a tournament. Choose how to delete:
                <br /><br />
                <strong>Delete Registrant Only</strong> — removes the registration entry only. Keeps tournament player, team assignment, and scores intact.
                <br /><br />
                <strong>Delete Registrant + Tournament Data</strong> — also removes the player from the tournament, including their team assignment and all scores. Use only mid-tournament when you need to fully remove a player.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel disabled={!!processingEntryId}>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                disabled={!!processingEntryId}
                onClick={() => entryToDelete && performDelete(entryToDelete, 'entry_only')}
              >
                Delete Registrant Only
              </Button>
              <Button
                disabled={!!processingEntryId}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => entryToDelete && performDelete(entryToDelete, 'entry_and_tournament')}
              >
                Delete Registrant + Tournament Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }


  // List view
  return (
    <div className="min-h-screen bg-background p-4 pb-24 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tournament-admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Registrations</h1>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>

        {showCreateForm && (
          <RegistrationConfigForm
            onSubmit={handleCreate}
            isSubmitting={isSubmitting}
            onCreateSheet={selectedConfig?.google_refresh_token ? handleCreateSheet : handleConnectGoogle}
          />
        )}

        {!showCreateForm && configs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Users className="w-12 h-12 mx-auto text-muted-foreground" />
              <h2 className="font-bold">No registration pages yet</h2>
              <p className="text-sm text-muted-foreground">Create one to start collecting signups</p>
              <Button onClick={() => setShowCreateForm(true)}>Create Registration Page</Button>
            </CardContent>
          </Card>
        ) : !showCreateForm ? (
          configs.map(cfg => (
            <Card
              key={cfg.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/tournament-admin/registrations/${cfg.id}`)}
            >
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold flex-1 truncate">{cfg.name}</h3>
                  <Badge variant={cfg.is_open ? 'default' : 'secondary'}>
                    {cfg.is_open ? 'Open' : 'Closed'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 -mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfigToDelete(cfg);
                    }}
                    aria-label="Delete registration"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{cfg.location} • {cfg.event_dates}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Copy className="w-3 h-3" />
                  <span>Code: {cfg.share_code}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : null}
      </div>

      <AlertDialog open={!!configToDelete} onOpenChange={(open) => !open && !deletingConfig && setConfigToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{configToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the registration page, all signup entries, and the linked Google Sheet. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConfig}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConfig(); }}
              disabled={deletingConfig}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingConfig ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentRegistrationAdmin;
