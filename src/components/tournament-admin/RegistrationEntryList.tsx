import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';

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
  status?: 'pending' | 'approved' | 'rejected';
}

interface RegistrationEntryListProps {
  entries: Entry[];
  isLoading: boolean;
  onApprove?: (entry: Entry) => Promise<void>;
  onReject?: (entry: Entry) => Promise<void>;
  onDelete?: (entry: Entry) => Promise<void>;
  onSyncToSheet?: (entry: Entry) => Promise<void>;
  processingId?: string | null;
}

const StatusBadge: React.FC<{ status: Entry['status'] }> = ({ status }) => {
  if (status === 'approved') {
    return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Player</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="secondary" className="text-muted-foreground">Rejected</Badge>;
  }
  return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>;
};

const RegistrationEntryList: React.FC<RegistrationEntryListProps> = ({
  entries,
  isLoading,
  onApprove,
  onReject,
  onDelete,
  onSyncToSheet,
  processingId,
}) => {
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

  const pending = entries.filter(e => !e.status || e.status === 'pending').length;
  const approved = entries.filter(e => e.status === 'approved').length;
  const rejected = entries.filter(e => e.status === 'rejected').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
          <span>Registrants ({entries.length})</span>
          <span className="text-sm font-normal text-muted-foreground">
            {pending > 0 && <span className="text-amber-600 font-medium">{pending} pending</span>}
            {pending > 0 && approved > 0 && ' · '}
            {approved > 0 && <span className="text-[hsl(var(--success))] font-medium">{approved} approved</span>}
            {(pending > 0 || approved > 0) && rejected > 0 && ' · '}
            {rejected > 0 && <span className="text-muted-foreground">{rejected} rejected</span>}
          </span>
        </CardTitle>
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
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {(onApprove || onReject || onDelete) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => {
                const isProcessing = processingId === entry.id;
                const isPending = !entry.status || entry.status === 'pending';
                return (
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
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                    {(onApprove || onReject || onDelete) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              {isPending && onApprove && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-[hsl(var(--success))] hover:text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/10"
                                  onClick={() => onApprove(entry)}
                                  title="Approve"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              )}
                              {isPending && onReject && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => onReject(entry)}
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => onDelete(entry)}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegistrationEntryList;
