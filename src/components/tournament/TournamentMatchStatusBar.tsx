import React, { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { MatchState, TournamentPlayer } from '@/types/tournament';

interface Props {
  tournamentName: string;
  roundName: string;
  teamMatchup: { teamAId: string; teamBId: string } | null;
  teams: Record<string, { name: string; color: string }>;
  teamTotals: Record<string, number>;
  holesPlayed: number;
  matchState?: MatchState;
  totalPointsAvailable: number;
  subMatchups?: { playerA: string; playerB: string }[];
  tournamentPlayers?: TournamentPlayer[];
  holeResults?: Record<number, { teamPoints: Record<string, number>; playerPoints?: Record<string, number> }>;
  teamAssignments?: Record<string, string>;
}

const AnimatedPoints: React.FC<{ value: number }> = ({ value }) => {
  const [displayed, setDisplayed] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    const start = prevValue.current;
    const diff = value - start;
    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayed(start + diff * progress);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  const formatted = Number.isInteger(displayed) ? displayed.toString() : displayed.toFixed(1);
  return <span>{formatted}</span>;
};

const TournamentMatchStatusBar: React.FC<Props> = ({
  tournamentName, roundName, teamMatchup, teams, teamTotals,
  holesPlayed, matchState, totalPointsAvailable,
  subMatchups, tournamentPlayers, holeResults, teamAssignments,
}) => {
  if (!teamMatchup) return null;

  const teamA = teams[teamMatchup.teamAId];
  const teamB = teams[teamMatchup.teamBId];
  const totalA = teamTotals[teamMatchup.teamAId] || 0;
  const totalB = teamTotals[teamMatchup.teamBId] || 0;
  const pointsUsed = totalA + totalB;
  const remaining = Math.max(0, totalPointsAvailable - pointsUsed);

  let statusLine = '';
  const winnerName = totalA > totalB ? teamA?.name : teamB?.name;

  if (matchState?.isComplete) {
    if (totalA === totalB) {
      statusLine = `Match Halved ${totalA} — ${totalB}`;
    } else {
      statusLine = `${winnerName} wins ${Math.max(totalA, totalB)} — ${Math.min(totalA, totalB)}`;
    }
  } else if (matchState?.isDormie) {
    statusLine = `Dormie • ${remaining} pts left`;
  } else if (totalA === totalB) {
    statusLine = `All Square • Thru ${holesPlayed} • ${remaining} pts left`;
  } else {
    const leader = totalA > totalB ? teamA?.name : teamB?.name;
    statusLine = `${leader} leads • Thru ${holesPlayed} • ${remaining} pts left`;
  }

  // Compute per-matchup status lines for 1v1 sub-matchups
  const subMatchupLines: { playerAName: string; playerBName: string; statusText: string; teamAColor?: string; teamBColor?: string }[] = [];
  if (subMatchups && subMatchups.length > 0 && tournamentPlayers && holeResults && teamAssignments) {
    const playerMap = Object.fromEntries(tournamentPlayers.map(p => [p.id, p]));

    subMatchups.forEach((sm, idx) => {
      const pA = playerMap[sm.playerA];
      const pB = playerMap[sm.playerB];
      if (!pA || !pB) return;

      const aTeamId = teamAssignments[sm.playerA];
      const bTeamId = teamAssignments[sm.playerB];

      // Sum player points across all holes
      let aPts = 0, bPts = 0;
      let holesComplete = 0;
      Object.values(holeResults).forEach(hr => {
        const ppA = hr.playerPoints?.[sm.playerA];
        const ppB = hr.playerPoints?.[sm.playerB];
        if (ppA !== undefined || ppB !== undefined) {
          aPts += ppA || 0;
          bPts += ppB || 0;
          holesComplete++;
        }
      });

      // Per-matchup holes = total holes / number of sub-matchups (they share holes)
      // Actually each sub-matchup plays all holes, so holesComplete is per pair
      const perMatchHoles = Math.floor(holesComplete / subMatchups.length);

      let text: string;
      if (aPts === bPts) {
        text = `All Square`;
      } else if (aPts > bPts) {
        text = `${pA.displayName.split(' ')[0]} ${aPts - bPts} UP`;
      } else {
        text = `${pB.displayName.split(' ')[0]} ${bPts - aPts} UP`;
      }

      subMatchupLines.push({
        playerAName: pA.displayName.split(' ')[0],
        playerBName: pB.displayName.split(' ')[0],
        statusText: text,
        teamAColor: teams[aTeamId]?.color,
        teamBColor: teams[bTeamId]?.color,
      });
    });
  }

  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground tracking-wider"
          style={{ fontVariantCaps: 'small-caps' }}
        >
          <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--brand-gold))' }} />
          <span>{tournamentName}{roundName ? ` — ${roundName}` : ''}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA?.color }} />
            <span className={`font-semibold text-sm ${totalA >= totalB ? 'text-foreground' : 'text-muted-foreground'}`}>
              {teamA?.name || 'Team A'}
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground font-mono">
            <AnimatedPoints value={totalA} />
            <span className="text-muted-foreground text-lg"> — </span>
            <AnimatedPoints value={totalB} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${totalB >= totalA ? 'text-foreground' : 'text-muted-foreground'}`}>
              {teamB?.name || 'Team B'}
            </span>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB?.color }} />
          </div>
        </div>

        <p className={`text-xs text-center ${matchState?.isComplete ? 'text-[hsl(var(--brand-gold))] font-bold' : 'text-muted-foreground'}`}>
          {statusLine}
        </p>

        {/* Sub-matchup status lines for 1v1 formats */}
        {subMatchupLines.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
            {subMatchupLines.map((sm, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sm.teamAColor }} />
                  <span className="font-medium text-foreground">{sm.playerAName}</span>
                  <span className="text-muted-foreground/60">vs</span>
                  <span className="font-medium text-foreground">{sm.playerBName}</span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sm.teamBColor }} />
                </div>
                <span className="font-semibold text-muted-foreground">{sm.statusText}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Complete Banner (#61) */}
      {matchState?.isComplete && (
        <div className="rounded-xl border p-3 text-center text-sm font-bold"
          style={{
            backgroundColor: 'hsl(45 93% 47% / 0.15)',
            borderColor: 'hsl(45 93% 47% / 0.4)',
            color: 'hsl(45 93% 47%)',
          }}
        >
          Match Complete 🏆{' '}
          {totalA === totalB
            ? `Match Halved ${totalA} — ${totalB}`
            : `${winnerName} wins ${Math.max(totalA, totalB)}pts to ${Math.min(totalA, totalB)}pts`}
        </div>
      )}
    </div>
  );
};

export default TournamentMatchStatusBar;
