import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminRoundProvider, useAdminRound } from '@/contexts/AdminRoundContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Eye, FileText, Trophy, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import AdminScorecard from '@/components/AdminScorecard';
import AdminRoundSummary from '@/components/AdminRoundSummary';
import AdminActiveRound from '@/components/AdminActiveRound';

const AdminRoundViewContent: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, isLoading, error } = useAdminRound();
  const [activeTab, setActiveTab] = useState('scorecard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading round data...</p>
        </div>
      </div>
    );
  }

  if (error || !currentRound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Error Loading Round</h2>
        <p className="text-muted-foreground mb-6">{error || 'Round not found'}</p>
        <Button onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const roundDate = format(new Date(currentRound.startTime), 'MMM d, yyyy');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">{currentRound.course.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {roundDate} • {currentRound.players.length} Players
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <Eye className="w-3 h-3 mr-1" /> Read-Only
            </Badge>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-transparent h-auto p-0">
              <TabsTrigger 
                value="scorecard" 
                className="flex items-center gap-2 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                <FileText className="w-4 h-4" />
                Scorecard
              </TabsTrigger>
              <TabsTrigger 
                value="hole-by-hole"
                className="flex items-center gap-2 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                <Eye className="w-4 h-4" />
                Holes
              </TabsTrigger>
              <TabsTrigger 
                value="summary"
                className="flex items-center gap-2 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                <Trophy className="w-4 h-4" />
                Summary
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'scorecard' && <AdminScorecard />}
        {activeTab === 'hole-by-hole' && <AdminActiveRound />}
        {activeTab === 'summary' && <AdminRoundSummary />}
      </div>
    </div>
  );
};

const AdminRoundView: React.FC = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  if (!roundId) {
    navigate('/admin');
    return null;
  }

  return (
    <AdminRoundProvider roundId={roundId}>
      <AdminRoundViewContent />
    </AdminRoundProvider>
  );
};

export default AdminRoundView;
