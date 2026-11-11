import React from 'react';
import type { Player } from '@/types';
import type { TournamentGame, TournamentPlayer } from '@/types/tournament';
import { calcCourseHandicap, getEffectiveHandicap, strokesReceived } from '@/services/tournamentEngine';

interface Props {
  players: Player[];
  playerMapping: Record<string, string>;
  tournamentPlayers: TournamentPlayer[];
  teamAssignments: Record<string, string>;
  teams: Record<string, { name: string; color: string }>;
  teamOrder?: string[];
  game: TournamentGame;
  holeScores: Record<string, number> | undefined;
  par: number;
  holeHandicapIndex?: number;
  readOnly: boolean;
  onSetTeamScore: (entries: Record<string, number>) => void;
}

/** Scramble formats: one shared score card per team instead of per player. */
const ScrambleTeamCards: React.FC<Props> = ({
  players, playerMapping, tournamentPlayers, teamAssignments, teams, teamOrder,
  game, holeScores, par, holeHandicapIndex, readOnly, onSetTeamScore,
}) => {
  const tpById = Object.fromEntries(tournamentPlayers.map(tp => [tp.id, tp]));
  const byTeam: Record<string, Player[]> = {};
  players.forEach(p => {
    const tid = teamAssignments[playerMapping[p.id]];
    if (!tid) return;
    (byTeam[tid] ||= []).push(p);
  });
  const teamIds = [
    ...(teamOrder || []).filter(t => byTeam[t]),
    ...Object.keys(byTeam).filter(t => !(teamOrder || []).includes(t)),
  ];

  return (
    <div className="space-y-3">
      {teamIds.map((tid, idx) => {
        const members = byTeam[tid];
        const shared = members.map(m => holeScores?.[m.id]).find((v): v is number => typeof v === 'number');
        const hasScore = shared !== undefined;
        const display = hasScore ? shared : par;
        const allowance = (game.handicapAllowancePercent ?? 100) / 100;
        const teamHcp = Math.round(members.reduce((sum, m) => {
          const tp = tpById[playerMapping[m.id]];
          return sum + (tp ? calcCourseHandicap(getEffectiveHandicap(tp) * allowance) : 0);
        }, 0) * 0.25);
        const strokes = game.useHandicaps && holeHandicapIndex ? strokesReceived(teamHcp, holeHandicapIndex) : 0;
        const net = hasScore ? shared - strokes : '-';
        const isA = idx === 0;
        const setScore = (v: number) => {
          if (readOnly || v < 1 || v > 99) return;
          onSetTeamScore(Object.fromEntries(members.map(m => [m.id, v])));
        };
        return (
          <React.Fragment key={tid}>
            {idx === 1 && <div className="text-center text-xs font-bold text-muted-foreground uppercase">vs</div>}
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${isA ? 'border-primary/30 bg-primary/10' : 'border-destructive/30 bg-destructive/10'}`}>
              <div className={`p-4 flex items-center justify-between border-b ${isA ? 'bg-primary/15 border-primary/20' : 'bg-destructive/15 border-destructive/20'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${isA ? 'bg-primary' : 'bg-destructive'}`} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate">{teams[tid]?.name || `Team ${isA ? 'A' : 'B'}`}</h3>
                    <p className="text-xs text-muted-foreground truncate">{members.map(m => m.name).join(' & ')}</p>
                    {game.useHandicaps && (
                      <div className="flex gap-2 text-xs font-bold mt-1">
                        <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">{teamHcp} Team HCP</span>
                        {strokes > 0 && (
                          <span className="px-2 py-0.5 rounded border" style={{ color: 'hsl(var(--brand-gold))', borderColor: 'hsl(var(--brand-gold) / 0.4)', backgroundColor: 'hsl(var(--brand-gold) / 0.12)' }}>
                            {strokes > 1 ? `•• Stroke x${strokes}` : '• Stroke'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Net</span>
                  <span className="text-2xl font-bold text-foreground">{net}</span>
                </div>
              </div>
              <div className={`grid grid-cols-3 divide-x divide-border bg-muted/50 h-16 ${readOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                <button aria-label="Lower team score" onClick={() => setScore((hasScore ? shared : par) - 1)} disabled={readOnly} className="flex items-center justify-center active:bg-muted">
                  <span className="text-3xl text-primary font-light">-</span>
                </button>
                <button aria-label="Confirm team score" onClick={() => setScore(display)} disabled={readOnly} className="flex items-center justify-center bg-card active:bg-muted">
                  <span className={`text-3xl font-bold ${!hasScore ? 'text-muted-foreground' : 'text-foreground'}`}>{display}</span>
                </button>
                <button aria-label="Raise team score" onClick={() => setScore((hasScore ? shared : par) + 1)} disabled={readOnly} className="flex items-center justify-center active:bg-muted">
                  <span className="text-3xl text-primary font-light">+</span>
                </button>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ScrambleTeamCards;
