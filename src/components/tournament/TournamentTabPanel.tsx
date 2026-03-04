import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import TournamentMatchStatusBar from './TournamentMatchStatusBar';
import TournamentHoleTracker from './TournamentHoleTracker';
import TournamentPlayerSummary from './TournamentPlayerSummary';
import TournamentSegmentTracker from './TournamentSegmentTracker';
import TournamentFullScorecard from './TournamentFullScorecard';
import TournamentPointsAnimation from './TournamentPointsAnimation';
import type { SegmentTotal, NewHoleEvent } from '@/hooks/useTournamentOverlay';
import type { TournamentPlayer, TournamentGame, MatchState } from '@/types/tournament';
import type { CourseHole } from '@/services/tournamentEngine';

interface Props {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
  matchState?: MatchState;
  holeResults: Record<number, any>;
  courseHoles: CourseHole[];
  tournamentGame: TournamentGame | null;
  tournamentPlayers: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  allHoleScores: Record<string, Record<number, number>>;
  segmentTotals: SegmentTotal[] | null;
  newlyCompletedHole: NewHoleEvent | null;
}

const TournamentTabPanel: React.FC<Props> = ({
  tournamentName, roundName, teamMatchup, teams, teamTotals, holesPlayed,
  matchState, holeResults, courseHoles, tournamentGame, tournamentPlayers,
  teamAssignments, allHoleScores, segmentTotals, newlyCompletedHole,
}) => {
  const [showFullScorecard, setShowFullScorecard] = useState(false);

  const isSumOfStrokes = tournamentGame?.gameType === 'tournament_sixes' && tournamentGame?.sixesFormat === 'sum_of_strokes';

  const totalPointsAvailable = isSumOfStrokes && segmentTotals
    ? segmentTotals.reduce((s, seg) => s + seg.pointsAvailable, 0)
    : (tournamentGame?.defaultPointsPerHole || 1) * courseHoles.length;

  return (
    <div className="space-y-3">
      {/* Animation banner */}
      <TournamentPointsAnimation event={newlyCompletedHole} teams={teams} />

      {/* Section A: Match Status */}
      <TournamentMatchStatusBar
        tournamentName={tournamentName}
        roundName={roundName}
        teamMatchup={teamMatchup}
        teams={teams}
        teamTotals={teamTotals}
        holesPlayed={holesPlayed}
        matchState={matchState}
        totalPointsAvailable={totalPointsAvailable}
      />

      {/* Section B: Hole Tracker or Segment Tracker */}
      {isSumOfStrokes && segmentTotals ? (
        <TournamentSegmentTracker
          segments={segmentTotals}
          teams={teams}
          teamMatchup={teamMatchup}
        />
      ) : (
        <TournamentHoleTracker
          holeResults={holeResults}
          teamMatchup={teamMatchup}
          teams={teams}
          courseHoles={courseHoles}
          gameType={tournamentGame?.gameType}
          teamAssignments={teamAssignments}
          matchState={matchState}
        />
      )}

      {/* Section C: Player Summary */}
      <TournamentPlayerSummary
        players={tournamentPlayers}
        teamAssignments={teamAssignments}
        teams={teams}
        allHoleScores={allHoleScores}
        holeResults={holeResults}
        holesPlayed={holesPlayed}
      />

      {/* Full Scorecard Button */}
      <button
        onClick={() => setShowFullScorecard(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        <ClipboardList className="w-4 h-4" /> Full Scorecard
      </button>

      {/* Full Scorecard Modal */}
      <TournamentFullScorecard
        isOpen={showFullScorecard}
        onClose={() => setShowFullScorecard(false)}
        players={tournamentPlayers}
        teams={teams}
        teamAssignments={teamAssignments}
        teamMatchup={teamMatchup}
        courseHoles={courseHoles}
        game={tournamentGame}
        allHoleScores={allHoleScores}
        holeResults={holeResults}
        teamTotals={teamTotals}
        matchState={matchState}
        tournamentName={tournamentName}
        roundName={roundName}
      />
    </div>
  );
};

export default TournamentTabPanel;
