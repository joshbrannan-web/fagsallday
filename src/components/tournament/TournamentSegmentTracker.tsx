import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';
import type { SegmentTotal } from '@/hooks/useTournamentOverlay';

interface Props {
  segments: SegmentTotal[];
  teams: Record<string, { name: string; color: string }>;
  teamMatchup: { teamAId: string; teamBId: string } | null;
}

const SEGMENT_LABELS = ['Holes 1–6', 'Holes 7–12', 'Holes 13–18'];

const TournamentSegmentTracker: React.FC<Props> = ({ segments, teams, teamMatchup }) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => {
        const isActive = seg.holesComplete > 0 && !seg.isComplete;
        const borderClass = seg.isComplete
          ? 'border-l-4 border-l-yellow-500'
          : isActive
          ? 'border-l-4 border-l-primary'
          : '';

        return (
          <div key={idx} className={`bg-card border border-border rounded-xl p-4 ${borderClass}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-foreground">{SEGMENT_LABELS[idx]}</span>
              <span className="text-xs text-muted-foreground">{seg.pointsAvailable} pts available</span>
            </div>

            {seg.holesComplete === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Not started yet</p>
            ) : (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA?.color }} />
                    <span className="font-mono font-semibold">
                      {seg.teamSums[teamMatchup.teamAId] || 0}
                    </span>
                    {seg.isComplete && seg.winnerTeamId === teamMatchup.teamAId && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {seg.isComplete && seg.winnerTeamId === teamMatchup.teamBId && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span className="font-mono font-semibold">
                      {seg.teamSums[teamMatchup.teamBId] || 0}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB?.color }} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{seg.label}</p>

                {!seg.isComplete && (
                  <div className="flex items-center gap-2">
                    <Progress value={(seg.holesComplete / seg.totalHoles) * 100} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {seg.holesComplete}/{seg.totalHoles}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TournamentSegmentTracker;
