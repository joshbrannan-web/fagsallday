import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sheet, SkipForward } from 'lucide-react';

interface RegistrationConfigFormProps {
  onSubmit: (config: {
    name: string;
    description: string;
    location: string;
    event_dates: string;
    amount: number;
    amount_label: string;
    venmo_link: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  onCreateSheet?: () => void;
}

const RegistrationConfigForm: React.FC<RegistrationConfigFormProps> = ({ onSubmit, isSubmitting, onCreateSheet }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDates, setEventDates] = useState('');
  const [amount, setAmount] = useState('');
  const [amountLabel, setAmountLabel] = useState('Deposit');
  const [venmoLink, setVenmoLink] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      event_dates: eventDates.trim(),
      amount: parseFloat(amount) || 0,
      amount_label: amountLabel,
      venmo_link: venmoLink.trim().match(/^https?:\/\//) ? venmoLink.trim() : `https://${venmoLink.trim()}`,
    });
    if (onCreateSheet) setSubmitted(true);
  };

  const isValid = name.trim() && location.trim() && eventDates.trim() && venmoLink.trim() && parseFloat(amount) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create Registration Page</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-name">Tournament / Event Name *</Label>
            <Input id="reg-name" value={name} onChange={e => setName(e.target.value)} placeholder="Spring Classic 2026" maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-desc">Description</Label>
            <Textarea id="reg-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details about the event..." rows={3} maxLength={1000} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-location">Location / Course *</Label>
            <Input id="reg-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Pine Valley Golf Club" maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-dates">Event Dates *</Label>
            <Input id="reg-dates" value={eventDates} onChange={e => setEventDates(e.target.value)} placeholder="May 15-17, 2026" maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reg-amount">Amount ($) *</Label>
              <Input id="reg-amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="150.00" />
            </div>
            <div className="space-y-2">
              <Label>Amount Type</Label>
              <Select value={amountLabel} onValueChange={setAmountLabel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deposit">Deposit</SelectItem>
                  <SelectItem value="Total">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-venmo">Venmo Link *</Label>
            <Input id="reg-venmo" value={venmoLink} onChange={e => setVenmoLink(e.target.value)} placeholder="https://venmo.com/u/YourUsername" maxLength={300} />
          </div>

          {!submitted ? (
            <Button type="submit" className="w-full" disabled={!isValid || isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : 'Create Registration Page'}
            </Button>
          ) : (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Registration page created! Would you like to set up a Google Sheet to track registrations?
              </p>
              <div className="flex gap-2">
                {onCreateSheet && (
                  <Button type="button" variant="outline" className="flex-1" onClick={onCreateSheet}>
                    <Sheet className="w-4 h-4 mr-2" /> Create Google Sheet
                  </Button>
                )}
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setSubmitted(false)}>
                  <SkipForward className="w-4 h-4 mr-2" /> Skip for Now
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistrationConfigForm;
