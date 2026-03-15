import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList } from "lucide-react";
import TournamentMatchStatusBar from "./TournamentMatchStatusBar";
import TournamentHoleTracker from "./TournamentHoleTracker";
import TournamentPlayerSummary from "./TournamentPlayerSummary";
import TournamentSegmentTracker from "./TournamentSegmentTracker";
import TournamentFullScorecard from "./TournamentFullScorecard";
import TournamentPointsAnimation from "./TournamentPointsAnimation";
import ScoreboardSelector from "@/components/scoreboards/ScoreboardSelector";
import ScoreboardRenderer from "@/components/scoreboards/ScoreboardRenderer";
import { useTournamentScoreboards } from "@/hooks/useTournamentScoreboards";
import { Skeleton } from "@/components/ui/skeleton";
import type { SegmentTotal, NewHoleEvent } from "@/hooks/useTournamentOverlay";
import type { TournamentPlayer, TournamentGame, MatchState } from "@/types/tournament";
import type { CourseHole } from "@/services/tournamentEngine";

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
  tournamentId?: string;
  subMatchups?: { playerA: string; playerB: string }[];
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 py-1">
    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">{children}</span>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

const TournamentTabPanel: React.FC<Props> = ({
  tournamentName,
  roundName,
  teamMatchup,
  teams,
  teamTotals,
  holesPlayed,
  matchState,
  holeResults,
  courseHoles,
  tournamentGame,
  tournamentPlayers,
  teamAssignments,
  allHoleScores,
  segmentTotals,
  newlyCompletedHole,
  tournamentId,
  subMatchups,
}) => {
  const [activeTab, setActiveTab] = useState<"game" | "boards">("game");
  const [showFullScorecard, setShowFullScorecard] = useState(false);
  const [selectedScoreboardId, setSelectedScoreboardId] = useState<string>("");

  const sbData = useTournamentScoreboards(tournamentId);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!tournamentId) return;
    supabase.from("tournaments").select("join_code").eq("id", tournamentId).single()
      .then(({ data }) => { if (data) setJoinCode(data.join_code); });
  }, [tournamentId]);

  useEffect(() => {
    if (sbData.scoreboards.length > 0 && !selectedScoreboardId) {
      setSelectedScoreboardId(sbData.scoreboards[0].id);
    }
  }, [sbData.scoreboards, selectedScoreboardId]);

  const isSumOfStrokes =
    tournamentGame?.gameType === "tournament_sixes" && tournamentGame?.sixesFormat === "sum_of_strokes";

  const totalPointsAvailable =
    isSumOfStrokes && segmentTotals
      ? segmentTotals.reduce((s, seg) => s + seg.pointsAvailable, 0)
      : (tournamentGame?.defaultPointsPerHole || 1) * courseHoles.length;

  const selectedScoreboard = sbData.scoreboards.find((sb) => sb.id === selectedScoreboardId);
  const hasScoreboards = tournamentId && sbData.scoreboards.length > 0;

  return (
    <div className="space-y-0">
      {/* Points animation stays above tabs */}
      <TournamentPointsAnimation event={newlyCompletedHole} teams={teams} />

      {/* Tab bar — only show if scoreboards exist */}
      {hasScoreboards && (
        <div className="flex border-b border-border mb-4">
          {[
            { id: "game" as const, label: "My Game" },
            { id: "boards" as const, label: "Leaderboards" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-[13px] font-bold tracking-wide transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[hsl(var(--brand-gold))] text-[hsl(var(--brand-gold))]"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* MY GAME TAB */}
      {(activeTab === "game" || !hasScoreboards) && (
        <div className="space-y-4">
          {/* Match banner */}
          <TournamentMatchStatusBar
            tournamentName={tournamentName}
            roundName={roundName}
            teamMatchup={teamMatchup}
            teams={teams}
            teamTotals={teamTotals}
            holesPlayed={holesPlayed}
            matchState={matchState}
            totalPointsAvailable={totalPointsAvailable}
            subMatchups={subMatchups}
            tournamentPlayers={tournamentPlayers}
            holeResults={holeResults}
            teamAssignments={teamAssignments}
          />

          {/* Players */}
          <SectionLabel>Players · This Round</SectionLabel>
          <TournamentPlayerSummary
            players={tournamentPlayers}
            teamAssignments={teamAssignments}
            teams={teams}
            allHoleScores={allHoleScores}
            holeResults={holeResults}
            holesPlayed={holesPlayed}
            subMatchups={subMatchups}
            teamAId={teamMatchup?.teamAId}
          />

          {/* Hole tracker */}
          <SectionLabel>Hole by Hole</SectionLabel>
          {isSumOfStrokes && segmentTotals ? (
            <TournamentSegmentTracker segments={segmentTotals} teams={teams} teamMatchup={teamMatchup} />
          ) : (
            <TournamentHoleTracker
              holeResults={holeResults}
              teamMatchup={teamMatchup}
              teams={teams}
              courseHoles={courseHoles}
              gameType={tournamentGame?.gameType}
              teamAssignments={teamAssignments}
              matchState={matchState}
              subMatchups={subMatchups}
              tournamentPlayers={tournamentPlayers}
            />
          )}

          {/* Full scorecard */}
          <button
            onClick={() => setShowFullScorecard(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-transparent text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            <ClipboardList className="w-4 h-4" /> Full Scorecard
          </button>

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
            subMatchups={subMatchups}
          />
        </div>
      )}

      {/* LEADERBOARDS TAB */}
      {activeTab === "boards" && hasScoreboards && (
        <div className="space-y-3">
          <ScoreboardSelector
            scoreboards={sbData.scoreboards}
            selectedId={selectedScoreboardId}
            onSelect={setSelectedScoreboardId}
          />
          {sbData.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : selectedScoreboard ? (
            <ScoreboardRenderer
              scoreboard={selectedScoreboard}
              data={{
                teams: sbData.teams,
                rounds: sbData.rounds,
                players: sbData.players,
                groups: sbData.groups,
                groupPlayers: sbData.groupPlayers,
                holeResults: sbData.holeResults,
                holeScores: sbData.holeScores,
                games: sbData.games,
                tournamentStatus: sbData.isLive ? "active" : "completed",
                teamScoringMethod: sbData.teamScoringMethod,
                customRoundPoints: sbData.customRoundPoints,
              }}
              joinCode={joinCode}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TournamentTabPanel;
