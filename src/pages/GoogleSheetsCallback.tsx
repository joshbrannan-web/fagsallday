import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const GoogleSheetsCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        toast.error('Missing authorization code');
        setStatus('error');
        setTimeout(() => navigate('/tournament-admin/registrations'), 2000);
        return;
      }

      let configId: string;
      try {
        const parsed = JSON.parse(atob(state));
        configId = parsed.config_id;
      } catch {
        toast.error('Invalid callback state');
        setStatus('error');
        setTimeout(() => navigate('/tournament-admin/registrations'), 2000);
        return;
      }

      try {
        const redirectUri = window.location.origin;
        
        const { data, error } = await supabase.functions.invoke('google-sheets-exchange', {
          body: { code, config_id: configId, redirect_uri: redirectUri },
        });

        if (error || !data?.success) {
          throw error || new Error('Exchange failed');
        }

        toast.success('Google Sheets connected!');
        setStatus('success');
        setTimeout(() => navigate(`/tournament-admin/registrations/${configId}`), 1500);
      } catch (err: any) {
        console.error('OAuth exchange error:', err);
        toast.error('Failed to connect Google Sheets');
        setStatus('error');
        setTimeout(() => navigate(`/tournament-admin/registrations/${configId}`), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <>
            <Skeleton className="h-8 w-48 mx-auto" />
            <p className="text-muted-foreground">Connecting Google Sheets...</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-lg font-semibold text-green-600">✓ Connected! Redirecting...</p>
        )}
        {status === 'error' && (
          <p className="text-lg font-semibold text-destructive">Connection failed. Redirecting...</p>
        )}
      </div>
    </div>
  );
};

export default GoogleSheetsCallback;
