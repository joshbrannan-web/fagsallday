import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Entry {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  handicap_index: number | null;
  ghin_number: string | null;
  payment_confirmed: boolean;
  payment_amount: number | null;
  created_at: string;
}

interface RegistrationEntryListProps {
  entries: Entry[];
  isLoading: boolean;
}

const RegistrationEntryList: React.FC<RegistrationEntryListProps> = ({ entries, isLoading }) => {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading registrants...</div>;
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No registrations yet. Share your registration link to get started!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Registrants ({entries.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>HCP</TableHead>
                <TableHead>GHIN</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium whitespace-nowrap">{entry.full_name}</TableCell>
                  <TableCell className="text-sm">{entry.email}</TableCell>
                  <TableCell className="text-sm">{entry.phone || '—'}</TableCell>
                  <TableCell className="text-sm">{entry.handicap_index != null ? entry.handicap_index : '—'}</TableCell>
                  <TableCell className="text-sm">{entry.ghin_number || '—'}</TableCell>
                  <TableCell>
                    {entry.payment_confirmed ? (
                      <Badge variant="default" className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                        ${entry.payment_amount ?? 0}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegistrationEntryList;
