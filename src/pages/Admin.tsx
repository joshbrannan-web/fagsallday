import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { Users, Trophy, ArrowLeft, Trash2, KeyRound, Loader2, Shield, Mail, Send, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  handicap_index: number;
  created_at: string;
  rounds_count: number;
}

interface AdminRound {
  id: string;
  user_id: string;
  user_display_name: string;
  course_name: string;
  start_time: string;
  status: string;
  players_count: number;
}

interface AdminRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  display_name?: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [tournamentAdminIds, setTournamentAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin && session) {
      fetchData();
    }
  }, [isAdmin, session]);

  // Fetch admin requests after users are loaded (for display name enrichment)
  useEffect(() => {
    if (isAdmin && users.length > 0) {
      fetchAdminRequests();
    }
  }, [isAdmin, users]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users via edge function
      const { data: usersData, error: usersError } = await supabase.functions.invoke('admin-list-users');
      if (usersError) throw usersError;
      setUsers(usersData.users || []);

      // Fetch all rounds (admin can see all via RLS)
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .order('start_time', { ascending: false });
      
      if (roundsError) throw roundsError;

      // Map rounds with user display names
      const mappedRounds: AdminRound[] = (roundsData || []).map((round: any) => {
        const user = usersData.users?.find((u: AdminUser) => u.id === round.user_id);
        const courseData = round.course_data as any;
        const playersData = round.players_data as any[];
        
        return {
          id: round.id,
          user_id: round.user_id,
          user_display_name: user?.display_name || 'Unknown',
          course_name: courseData?.name || 'Unknown Course',
          start_time: round.start_time,
          status: round.status,
          players_count: playersData?.length || 0,
        };
      });
      
      setRounds(mappedRounds);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminRequests = async () => {
    const { data } = await supabase
      .from('tournament_admin_requests' as any)
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (!data) { setAdminRequests([]); return; }

    // Enrich with display names from users list or profiles
    const enriched: AdminRequest[] = (data as any[]).map((r: any) => {
      const u = users.find(u => u.id === r.user_id);
      return { ...r, display_name: u?.display_name || r.user_id };
    });
    setAdminRequests(enriched);
  };

  const handleApproveRequest = async (req: AdminRequest) => {
    setActionLoading(req.id);
    try {
      // Insert into tournament_admins
      const { error: insertErr } = await supabase
        .from('tournament_admins')
        .insert({ user_id: req.user_id, granted_by: session?.user?.id });
      if (insertErr) throw insertErr;

      // Update request status
      await supabase
        .from('tournament_admin_requests' as any)
        .update({ status: 'approved', reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString() } as any)
        .eq('id', req.id);

      setAdminRequests(prev => prev.filter(r => r.id !== req.id));
      toast.success(`${req.display_name} approved as tournament admin`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDenyRequest = async (req: AdminRequest) => {
    setActionLoading(req.id);
    try {
      await supabase
        .from('tournament_admin_requests' as any)
        .update({ status: 'denied', reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString() } as any)
        .eq('id', req.id);

      setAdminRequests(prev => prev.filter(r => r.id !== req.id));
      toast.success(`Request from ${req.display_name} denied`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deny');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setActionLoading(userToDelete.id);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: userToDelete.id }
      });
      
      if (error) throw error;
      
      toast.success(`User "${userToDelete.display_name}" deleted successfully`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setRounds(prev => prev.filter(r => r.user_id !== userToDelete.id));
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    setActionLoading(user.id);
    try {
      const { error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          userId: user.id, 
          userEmail: user.email,
          origin: window.location.origin 
        }
      });
      
      if (error) throw error;
      
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error(err.message || 'Failed to send password reset');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteDialog = (user: AdminUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleSendBroadcast = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-send-broadcast', {
        body: { subject: emailSubject, message: emailMessage }
      });
      
      if (error) throw error;
      
      toast.success(`Broadcast sent to ${data.sentCount} users`);
      setEmailSubject('');
      setEmailMessage('');
    } catch (err: any) {
      console.error('Error sending broadcast:', err);
      toast.error(err.message || 'Failed to send broadcast');
    } finally {
      setSendingEmail(false);
      setSendDialogOpen(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Admin Panel</h1>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Administrator
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Rounds
              </CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rounds.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="rounds" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Rounds
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2 relative">
              <Shield className="h-4 w-4" />
              Requests
              {adminRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {adminRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Handicap</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Rounds</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.display_name}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell className="text-right">{user.handicap_index}</TableCell>
                            <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-right">{user.rounds_count}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResetPassword(user)}
                                  disabled={actionLoading === user.id}
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <KeyRound className="h-4 w-4" />
                                  )}
                                </Button>
                                {session?.user?.id !== user.id && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openDeleteDialog(user)}
                                    disabled={actionLoading === user.id}
                                  >
                                    {actionLoading === user.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rounds" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Players</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rounds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No rounds found
                          </TableCell>
                        </TableRow>
                      ) : (
                      rounds.map((round) => (
                          <TableRow 
                            key={round.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/admin/round/${round.id}`)}
                          >
                            <TableCell className="font-medium">{round.user_display_name}</TableCell>
                            <TableCell>{round.course_name}</TableCell>
                            <TableCell>{format(new Date(round.start_time), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={round.status === 'COMPLETE' ? 'default' : 'secondary'}
                                className={round.status === 'COMPLETE' ? 'bg-primary/10 text-primary' : ''}
                              >
                                {round.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{round.players_count}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compose */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compose Broadcast</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    This will be sent to {users.length} registered user{users.length !== 1 ? 's' : ''}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      placeholder="e.g. New Feature: Track Your Bets"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      placeholder="Write your message here..."
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={8}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!emailSubject.trim() || !emailMessage.trim() || sendingEmail}
                    onClick={() => setSendDialogOpen(true)}
                  >
                    {sendingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send to All Users
                  </Button>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Email Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
                    <div className="p-6 bg-background rounded-lg m-4 shadow-sm">
                      <div className="text-center mb-6">
                        <h1 className="text-primary font-bold text-2xl">⛳ F&Gs All Day</h1>
                      </div>
                      <h2 className="text-foreground font-semibold text-lg mb-4">
                        {emailSubject || 'Your Subject Here'}
                      </h2>
                      <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                        {emailMessage || 'Your message will appear here...'}
                      </div>
                      <div className="text-center mt-6">
                        <span className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm">
                          Open F&Gs All Day
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center py-3">
                      © 2025 F&Gs All Day
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Tournament Admin Requests</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No pending requests
                          </TableCell>
                        </TableRow>
                      ) : (
                        adminRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.display_name}</TableCell>
                            <TableCell>{format(new Date(req.requested_at), 'MMM d, yyyy h:mm a')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleApproveRequest(req)}
                                  disabled={actionLoading === req.id}
                                >
                                  {actionLoading === req.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDenyRequest(req)}
                                  disabled={actionLoading === req.id}
                                >
                                  {actionLoading === req.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.display_name}</strong>'s account? 
              This will permanently remove their profile, all rounds, saved courses, and saved players. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Broadcast Confirmation Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Broadcast Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send "<strong>{emailSubject}</strong>" to all <strong>{users.length}</strong> registered users? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendBroadcast}>
              Send to All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
