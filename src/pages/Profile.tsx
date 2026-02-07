import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handicapIndex, setHandicapIndex] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setHandicapIndex(profile.handicap_index?.toString() || '0');
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

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    const parsedHandicap = parseFloat(handicapIndex) || 0;
    const clampedHandicap = Math.min(54, Math.max(-10, parsedHandicap));

    setIsSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      handicap_index: clampedHandicap,
    });
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
    </div>
  );
};

export default Profile;
