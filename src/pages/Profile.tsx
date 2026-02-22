import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, User, RefreshCw, CheckCircle2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import GhinSyncConfirmation from '@/components/GhinSyncConfirmation';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handicapIndex, setHandicapIndex] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false);

  const isGhinLinked = !!profile?.ghin_number;

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setHandicapIndex(profile.handicap_index?.toString() || '0');
      setGhinNumber(profile.ghin_number || '');
    }
  }, [profile]);

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
        <User className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">Sign in to edit your profile</h1>
        <p className="text-muted-foreground mb-6">
          Create an account to manage your profile settings.
        </p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  const handleSyncGhin = async (ghinNum?: string) => {
    const wasLinked = isGhinLinked;
    const numberToSync = ghinNum || ghinNumber;
    if (!numberToSync.trim() || !/^\d{5,9}$/.test(numberToSync.trim())) {
      toast.error('Enter a valid GHIN number (5-9 digits)');
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-ghin-handicap', {
        body: { ghin_number: numberToSync.trim(), update_profile: true },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setHandicapIndex(data.handicap_index.toString());
      setGhinNumber(numberToSync.trim());

      // Update local profile state
      await updateProfile({
        ghin_number: numberToSync.trim(),
        ghin_last_synced: new Date().toISOString(),
        handicap_index: data.handicap_index,
      });

      toast.success(`Handicap synced: ${data.handicap_index} (${data.golfer_name})`);
      if (!wasLinked) {
        setShowSyncConfirmation(true);
      }
    } catch (err: any) {
      console.error('GHIN sync error:', err);
      toast.error('Failed to sync from GHIN');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectGhin = async () => {
    setIsSaving(true);
    const { error } = await updateProfile({
      ghin_number: null,
      ghin_last_synced: null,
    });
    setIsSaving(false);

    if (error) {
      toast.error('Failed to disconnect GHIN');
    } else {
      setGhinNumber('');
      toast.success('GHIN disconnected. Handicap is now manual.');
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    const parsedHandicap = parseFloat(handicapIndex) || 0;
    const clampedHandicap = Math.min(54, Math.max(-10, parsedHandicap));

    setIsSaving(true);
    const updates: any = {
      display_name: displayName.trim(),
    };

    // Only update handicap if not GHIN-linked
    if (!isGhinLinked) {
      updates.handicap_index = clampedHandicap;
    }

    const { error } = await updateProfile(updates);
    setIsSaving(false);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      navigate('/');
    }
  };

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
          <h1 className="text-xl font-bold text-foreground">Edit Profile</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="handicapIndex">Handicap Index</Label>
          {isGhinLinked ? (
            <div className="flex items-center gap-2">
              <Input
                id="handicapIndex"
                type="number"
                value={handicapIndex}
                disabled
                className="opacity-70"
              />
              <div className="flex items-center gap-1 text-primary shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">GHIN</span>
              </div>
            </div>
          ) : (
            <>
              <Input
                id="handicapIndex"
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={handicapIndex}
                onChange={(e) => setHandicapIndex(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Valid range: -10 to 54</p>
            </>
          )}
        </div>

        {/* GHIN Section */}
        <div className="space-y-3 border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">USGA GHIN</Label>
            {isGhinLinked && (
              <button
                onClick={handleDisconnectGhin}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Unlink className="w-3 h-3" />
                Disconnect
              </button>
            )}
          </div>

          {isGhinLinked ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">GHIN #{profile?.ghin_number}</p>
                  {profile?.ghin_last_synced && (
                    <p className="text-xs text-muted-foreground">
                      Last synced {formatDistanceToNow(new Date(profile.ghin_last_synced), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSyncGhin(profile?.ghin_number || '')}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-1">Refresh</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Link your GHIN number to auto-sync your official USGA Handicap Index.
              </p>
              <div className="flex gap-2">
                <Input
                  value={ghinNumber}
                  onChange={(e) => setGhinNumber(e.target.value)}
                  placeholder="e.g. 1234567"
                  maxLength={9}
                />
                <Button
                  onClick={() => handleSyncGhin()}
                  disabled={isSyncing || !ghinNumber.trim()}
                  variant="secondary"
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Link'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      <GhinSyncConfirmation open={showSyncConfirmation} onClose={() => setShowSyncConfirmation(false)} />
    </div>
  );
};

export default Profile;
