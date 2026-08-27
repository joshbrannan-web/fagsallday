import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTournamentAdmin } from '@/hooks/useTournamentAdmin';
import { useTournamentDetail } from '@/hooks/useTournamentDetail';
import { useTournamentOverlay } from '@/hooks/useTournamentOverlay';
import { useTournamentScorecard } from '@/hooks/useTournamentScorecard';
import { useTournamentGroups } from '@/hooks/useTournamentGroups';
import TournamentTabPanel from '@/components/tournament/TournamentTabPanel';
import GroupScorecardAdmin from '@/components/tournament-admin/GroupScorecardAdmin';
import DeleteGroupButton from '@/components/tournament-admin/DeleteGroupButton';
import { ArrowLeft, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import TestRoundBanner from '@/components/tournament/TestRoundBanner';
import { toast } from 'sonner';
import { useSmartBack } from '@/hooks/useSmartBack';

const TournamentAdminLiveView: React.FC = () => {
  const { tournamentId, roundId, groupId } = useParams();
  const navigate = useNavigate();
  const goBack = useSmartBack(`/tournament-admin/${tournamentId}`);
  const [searchParams] = useSearchParams();
  const isTest = searchParams.get('test') === '1';
  const { isTournamentAdmin, isLoading: adminLoading } = useTournamentAdmin();
  const { teams, players, tournament, rounds, isLoading: detailLoading } = useTournamentDetail(tournamentId);
  const { groups, groupPlayers } = useTournamentGroups(roundId, { isTest });
  const { scores, results, courseHoles, isLoading: scorecardLoading, batchOverrideScores } = useTournamentScorecard(groupId);

  // Get tournament/round names for overlay
  const round = rounds.find((r: any) => r.id === roundId);
  const tName = tournament?.name || '';
  const rName = round?.name || `Round ${round?.round_number || ''}`;

  const overlay = useTournamentOverlay(groupId, tName, rName);

  const [matchViewOpen, setMatchViewOpen] = useState(true);
  const [scoreEditorOpen, setScoreEditorOpen] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isTournamentAdmin) {
      toast.error('Access denied');
      navigate('/');
    }
  }, [adminLoading, isTournamentAdmin]);

  const isLoading = adminLoading || detailLoading || scorecardLoading || overlay.isLoading;

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
  const enrichedPlayers = thisGroupPlayers.map((gp: any) => {
    const player = players.find((p: any) => p.id === gp.tournament_player_id);
    return { ...gp, display_name: player?.display_name || 'Unknown' };
  });

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Admin Mode Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 py-2.5 px-4 flex items-center gap-2 sticky top-0 z-50">
        <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Admin Mode — Viewing as Player</span>
      </div>

      {/* Header */}
      <div className="p-4">
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
          <div>
            <h1 className="text-lg font-bold">Group {group?.group_number || '?'}</h1>
            <p className="text-xs text-muted-foreground">
              {enrichedPlayers.map((p: any) => p.display_name).join(' • ')}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          {/* Match View Section */}
          <Collapsible open={matchViewOpen} onOpenChange={setMatchViewOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm font-semibold">
              Match View
              {matchViewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <TournamentTabPanel
                tournamentName={overlay.tournamentName}
                roundName={overlay.roundName}
                teamMatchup={overlay.teamMatchup}
                teams={overlay.teams}
                teamTotals={overlay.teamTotals}
                holesPlayed={overlay.holesPlayed}
                matchState={overlay.matchState}
                holeResults={overlay.holeResults}
                courseHoles={overlay.courseHoles}
                tournamentGame={overlay.tournamentGame}
                tournamentPlayers={overlay.tournamentPlayers}
                teamAssignments={overlay.teamAssignments}
                allHoleScores={overlay.allHoleScores}
                segmentTotals={overlay.segmentTotals}
                newlyCompletedHole={overlay.newlyCompletedHole}
                tournamentId={tournamentId}
                subMatchups={overlay.subMatchups}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Score Editor Section */}
          <Collapsible open={scoreEditorOpen} onOpenChange={setScoreEditorOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm font-semibold">
              Score Editor
              {scoreEditorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <GroupScorecardAdmin
                groupPlayers={enrichedPlayers}
                teams={teams}
                scores={scores}
                results={results}
                courseHoles={courseHoles}
                onBatchSave={batchOverrideScores}
              />
            </CollapsibleContent>
          </Collapsible>

          <DeleteGroupButton
            groupId={groupId}
            groupNumber={group?.group_number}
            tournamentId={tournamentId}
          />
        </div>
      </div>

    </div>
  );
};

export default TournamentAdminLiveView;
