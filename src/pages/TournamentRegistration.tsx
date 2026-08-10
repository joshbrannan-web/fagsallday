import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapPin, Calendar, DollarSign, ExternalLink, Loader2, Trophy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ensureUrl = (url: string) =>
  url.match(/^https?:\/\//) ? url : `https://${url}`;

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const TournamentRegistration: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hcpSource, setHcpSource] = useState<'ghin' | 'manual'>('ghin');
  const [handicapIndex, setHandicapIndex] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
  const [ghinSyncing, setGhinSyncing] = useState(false);
  const [ghinSyncedAt, setGhinSyncedAt] = useState<string | null>(null);
  const lastSyncedGhinRef = useRef<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      if (!shareCode) return;
      const { data, error } = await supabase
        .from('tournament_registration_configs')
        .select('*')
        .eq('share_code', shareCode.toUpperCase())
        .eq('is_open', true)
        .maybeSingle();

      if (error) console.error('Error loading config:', error);
      setConfig(data);
      setLoading(false);
    };
    loadConfig();
  }, [shareCode]);

  // Auto-fill from profile if logged in
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, handicap_index, ghin_number')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        if (data.display_name && !fullName) setFullName(data.display_name);
        if (data.ghin_number && !ghinNumber) {
          setGhinNumber(data.ghin_number);
          setHcpSource('ghin');
        }
        if (data.handicap_index != null && !handicapIndex) {
          setHandicapIndex(String(data.handicap_index));
        }
      }
      if (user.email && !email) setEmail(user.email);
    };
    loadProfile();
  }, [user]);

  const syncGhin = async (ghin: string, silent = false) => {
    if (!/^\d{5,9}$/.test(ghin)) {
      if (!silent) toast.error('GHIN number must be 5-9 digits');
      return;
    }
    setGhinSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-ghin-handicap', {
        body: { ghin_number: ghin },
      });
      if (error || !data || data.error) {
        if (!silent) toast.error(data?.error || 'Failed to look up GHIN number');
        return;
      }
      setHandicapIndex(String(data.handicap_index));
      setGhinSyncedAt(new Date().toISOString());
      lastSyncedGhinRef.current = ghin;
      toast.success(`Handicap synced: ${data.handicap_index}`);
    } catch (err) {
      console.error('GHIN sync error:', err);
      if (!silent) toast.error('Failed to look up GHIN number');
    } finally {
      setGhinSyncing(false);
    }
  };

  const handleSyncGhin = () => syncGhin(ghinNumber.trim());

  // Auto-sync when the registrant enters a valid GHIN and doesn't press Sync
  const handleGhinBlur = () => {
    const ghin = ghinNumber.trim();
    if (hcpSource !== 'ghin') return;
    if (!/^\d{5,9}$/.test(ghin)) return;
    if (lastSyncedGhinRef.current === ghin) return;
    if (ghinSyncing) return;
    syncGhin(ghin, true);
  };


  const handleHcpSourceChange = (val: 'ghin' | 'manual') => {
    setHcpSource(val);
    setGhinSyncedAt(null);
    if (val === 'manual') {
      setGhinNumber('');
    } else {
      setHandicapIndex('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      toast.error('Name and email are required');
      return;
    }
    if (trimmedName.length > 200 || trimmedEmail.length > 255) {
      toast.error('Input too long');
      return;
    }

    setSubmitting(true);
    try {
      const entry = {
        id: crypto.randomUUID(),
        config_id: config.id,
        user_id: user?.id || null,
        full_name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || null,
        handicap_index: handicapIndex ? parseFloat(handicapIndex) : null,
        ghin_number: hcpSource === 'ghin' && ghinNumber.trim() ? ghinNumber.trim() : null,
        payment_confirmed: paymentConfirmed,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      };

      const { data, error } = await supabase.functions.invoke('submit-tournament-registration', {
        body: { entry, origin: window.location.origin },
      });

      if (error || (data && data.error)) {
        throw new Error(data?.error || error?.message || 'Submission failed');
      }

      setShowSuccessDialog(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err?.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-3">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-bold">Registration Not Found</h2>
            <p className="text-sm text-muted-foreground">This registration page doesn't exist or is no longer open.</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Event Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
              {config.name}
            </CardTitle>
            {config.description && (
              <CardDescription>{config.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{config.event_dates}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{config.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>{config.amount_label}: ${config.amount}</span>
            </div>
            {config.venmo_link && (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <a href={ensureUrl(config.venmo_link)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Pay via Venmo
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="r-name">Full Name *</Label>
                <Input id="r-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" maxLength={200} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="r-email">Email *</Label>
                <Input id="r-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" maxLength={255} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="r-phone">Phone</Label>
                <Input
                  id="r-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label>Handicap</Label>
                <Select value={hcpSource} onValueChange={(v) => handleHcpSourceChange(v as 'ghin' | 'manual')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ghin">GHIN #</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>

                {hcpSource === 'ghin' ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-2">
                      <Input
                        id="r-ghin"
                        inputMode="numeric"
                        value={ghinNumber}
                        onChange={e => {
                          setGhinNumber(e.target.value.replace(/\D/g, '').slice(0, 9));
                          setGhinSyncedAt(null);
                        }}
                        onBlur={handleGhinBlur}
                        placeholder="GHIN # (5-9 digits)"
                        maxLength={9}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSyncGhin}
                        disabled={ghinSyncing || !/^\d{5,9}$/.test(ghinNumber.trim())}
                      >
                        {ghinSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" /> Sync</>}
                      </Button>
                    </div>
                    {ghinSyncedAt && handicapIndex && (
                      <p className="text-xs text-muted-foreground">
                        ✓ Handicap Index: <strong>{handicapIndex}</strong> (synced {new Date(ghinSyncedAt).toLocaleTimeString()})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-1">
                    <Input
                      id="r-hcp"
                      type="number"
                      step="0.1"
                      min="-10"
                      max="54"
                      value={handicapIndex}
                      onChange={e => setHandicapIndex(e.target.value)}
                      placeholder="Handicap index (e.g. 12.5)"
                    />
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-secondary/30">
                <h4 className="font-medium text-sm">Payment</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="r-paid"
                    checked={paymentConfirmed}
                    onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                  />
                  <Label htmlFor="r-paid" className="text-sm">I have sent / will send my payment</Label>
                </div>
                {paymentConfirmed && (
                  <div className="space-y-2">
                    <Label htmlFor="r-amount">Amount Sent ($)</Label>
                    <Input id="r-amount" type="number" min="0" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={String(config.amount)} />
                  </div>
                )}
              </div>

              {user && (
                <p className="text-xs text-muted-foreground">
                  ✓ Logged in as {user.email} — your registration will be linked to your account.
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting || !fullName.trim() || !email.trim()}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : 'Submit Registration'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have Registered</AlertDialogTitle>
            <AlertDialogDescription>
              You will receive an email with instructions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate('/')}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentRegistration;
