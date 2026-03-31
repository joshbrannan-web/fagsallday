import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Copy, ExternalLink, Plus, Users, Link as LinkIcon, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import RegistrationConfigForm from '@/components/tournament-admin/RegistrationConfigForm';
import RegistrationEntryList from '@/components/tournament-admin/RegistrationEntryList';

const TournamentRegistrationAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { configId } = useParams<{ configId?: string }>();
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
    const { error } = await supabase
      .from('tournament_registration_configs')
      .update({ tournament_id: tournamentId === 'none' ? null : tournamentId })
      .eq('id', cfgId);

    if (error) {
      toast.error('Failed to link tournament');
    } else {
      setConfigs(prev => prev.map(c => c.id === cfgId ? { ...c, tournament_id: tournamentId === 'none' ? null : tournamentId } : c));
      toast.success('Tournament linked');
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
    const redirectUri = `${window.location.origin}${window.location.pathname}#/google-sheets-callback`;
    const state = btoa(JSON.stringify({ config_id: selectedConfig.id }));
    const scopes = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;
    window.location.href = url;
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
            <Badge variant={selectedConfig.is_open ? 'default' : 'secondary'}>
              {selectedConfig.is_open ? 'Open' : 'Closed'}
            </Badge>
          </div>

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
              </div>

              {selectedConfig.google_sheet_url ? (
                <Button asChild variant="outline" size="sm">
                  <a href={selectedConfig.google_sheet_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open Google Sheet
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleCreateSheet} disabled={creatingSheet}>
                  <Plus className="w-4 h-4 mr-2" /> {creatingSheet ? 'Creating…' : 'Create Google Sheet'}
                </Button>
              )}
            </CardContent>
          </Card>

          <RegistrationEntryList entries={entries} isLoading={entriesLoading} />
        </div>
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
          <RegistrationConfigForm onSubmit={handleCreate} isSubmitting={isSubmitting} />
        )}

        {configs.length === 0 && !showCreateForm ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Users className="w-12 h-12 mx-auto text-muted-foreground" />
              <h2 className="font-bold">No registration pages yet</h2>
              <p className="text-sm text-muted-foreground">Create one to start collecting signups</p>
              <Button onClick={() => setShowCreateForm(true)}>Create Registration Page</Button>
            </CardContent>
          </Card>
        ) : (
          configs.map(cfg => (
            <Card
              key={cfg.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/tournament-admin/registrations/${cfg.id}`)}
            >
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{cfg.name}</h3>
                  <Badge variant={cfg.is_open ? 'default' : 'secondary'}>
                    {cfg.is_open ? 'Open' : 'Closed'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{cfg.location} • {cfg.event_dates}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Copy className="w-3 h-3" />
                  <span>Code: {cfg.share_code}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TournamentRegistrationAdmin;
