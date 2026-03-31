import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Calendar, DollarSign, ExternalLink, CheckCircle2, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const TournamentRegistration: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user } = useAuth();

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [handicapIndex, setHandicapIndex] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
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
        if (data.handicap_index != null && !handicapIndex) setHandicapIndex(String(data.handicap_index));
        if (data.ghin_number && !ghinNumber) setGhinNumber(data.ghin_number);
      }
      if (user.email && !email) setEmail(user.email);
    };
    loadProfile();
  }, [user]);

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
        config_id: config.id,
        user_id: user?.id || null,
        full_name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || null,
        handicap_index: handicapIndex ? parseFloat(handicapIndex) : null,
        ghin_number: ghinNumber.trim() || null,
        payment_confirmed: paymentConfirmed,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      };

      const { error } = await supabase
        .from('tournament_registration_entries')
        .insert(entry);

      if (error) throw error;

      // Sync to Google Sheets (fire-and-forget)
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      fetch(`https://${projectId}.supabase.co/functions/v1/sync-registration-to-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: config.id, entry }),
      }).catch(err => console.warn('Sheet sync failed:', err));

      setSubmitted(true);
      toast.success('Registration submitted!');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error('Failed to submit registration');
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-[hsl(var(--success))]" />
            <h2 className="text-xl font-bold">You're Registered!</h2>
            <p className="text-muted-foreground">
              Your registration for <strong>{config.name}</strong> has been submitted.
            </p>
            {config.venmo_link && !paymentConfirmed && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Don't forget to send your {config.amount_label.toLowerCase()} of ${config.amount}
                </p>
                <Button asChild variant="outline">
                  <a href={config.venmo_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Pay via Venmo
                  </a>
                </Button>
              </div>
            )}
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
                <a href={config.venmo_link} target="_blank" rel="noopener noreferrer">
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
                <Input id="r-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" maxLength={20} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="r-hcp">Handicap Index</Label>
                  <Input id="r-hcp" type="number" step="0.1" min="-10" max="54" value={handicapIndex} onChange={e => setHandicapIndex(e.target.value)} placeholder="12.5" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-ghin">GHIN #</Label>
                  <Input id="r-ghin" value={ghinNumber} onChange={e => setGhinNumber(e.target.value)} placeholder="1234567" maxLength={20} />
                </div>
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
    </div>
  );
};

export default TournamentRegistration;
