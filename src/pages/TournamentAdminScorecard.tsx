import React, { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentScorecard } from '@/hooks/useTournamentScorecard';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { useTournamentGroups } from '@/hooks/useTournamentGroups';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import GroupScorecardAdmin from '@/components/tournament-admin/GroupScorecardAdmin';
import DeleteGroupButton from '@/components/tournament-admin/DeleteGroupButton';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';
import { toast } from 'sonner';
import { useSmartBack } from '@/hooks/useSmartBack';

const TournamentAdminScorecard: React.FC = () => {
  const { tournamentId, roundId, groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTest = searchParams.get('test') === '1';
  const goBack = useSmartBack(isTest ? `/tournament-admin/${tournamentId}/test/${roundId}` : `/tournament-admin/${tournamentId}`);
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const { teams, players, isLoading: detailLoading } = useTournamentDetail(tournamentId);
  const { groups, groupPlayers } = useTournamentGroups(roundId, { isTest });
  const { scores, results, courseHoles, isLoading: scorecardLoading, batchOverrideScores } = useTournamentScorecard(groupId);

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  const isLoading = adminLoading || detailLoading || scorecardLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const group = groups.find((g: any) => g.id === groupId);
  const thisGroupPlayers = groupPlayers.filter((gp: any) => gp.tournament_group_id === groupId);

  // Enrich group players with display names
  const enrichedPlayers = thisGroupPlayers.map((gp: any) => {
    const player = players.find((p: any) => p.id === gp.tournament_player_id);
    return { ...gp, display_name: player?.display_name || 'Unknown' };
  });

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      {isTest && roundId && (
        <div className="mb-4">
          <TestRoundBanner
            tournamentRoundId={roundId}
            tournamentId={tournamentId}
            resetRedirect={`/tournament-admin/${tournamentId}`}
          />
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Group {group?.group_number || '?'}</h1>
          <p className="text-xs text-muted-foreground">
            {enrichedPlayers.map((p: any) => p.display_name).join(' • ')}
          </p>
        </div>
        <Button size="sm" variant="default" onClick={() => navigate(`/tournament-admin/${tournamentId}/round/${roundId}/group/${groupId}/live`)}>
          View Live
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        <GroupScorecardAdmin
          groupPlayers={enrichedPlayers}
          teams={teams}
          scores={scores}
          results={results}
          courseHoles={courseHoles}
          onBatchSave={batchOverrideScores}
        />
        <DeleteGroupButton
          groupId={groupId}
          groupNumber={group?.group_number}
          tournamentId={tournamentId}
        />
      </div>
    </div>
  );
};

export default TournamentAdminScorecard;
