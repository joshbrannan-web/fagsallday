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
import { Users, Trophy, ArrowLeft, Trash2, KeyRound, Loader2, Shield } from 'lucide-react';
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

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="rounds" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Rounds
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
    </div>
  );
};

export default Admin;
