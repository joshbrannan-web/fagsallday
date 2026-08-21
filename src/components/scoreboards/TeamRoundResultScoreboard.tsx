import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import GroupResultRow from './GroupResultRow';
import { calcTeamTotals, calcRoundTeamAward, calcRoundMatchAward } from '@/services/scoreboardCalculations';


interface Props {
  teams: any[];
  rounds: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  players: any[];
  holeResults: any[];
  roundMatches?: any[];
  joinCode: string;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
}

const TeamRoundResultScoreboard: React.FC<Props> = ({
  teams, rounds, groups, groupPlayers, players, holeResults, roundMatches = [],
  joinCode, teamScoringMethod, customRoundPoints,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const navigate = useNavigate();


  if (teams.length < 2) return null;
  const teamA = teams[0];
  const teamB = teams[1];
  const teamIds = [teamA.id, teamB.id];
  const startedRounds = rounds.filter((r: any) => r.status !== 'pending');

  let grandA = 0, grandB = 0;

  const roundData = startedRounds.map((r: any) => {
    const roundGroups = groups[r.id] || [];
    const roundGroupIds = new Set(roundGroups.map((g: any) => g.id));
    // Cross-group matches store their results against the match, not a group.
    const matchesForRound = roundMatches.filter((m: any) => m.tournamentRoundId === r.id);
    const matchIds = new Set(matchesForRound.map((m: any) => m.id));
    const roundResults = holeResults.filter(
      (hr: any) =>
        roundGroupIds.has(hr.tournament_group_id) ||
        (hr.tournament_match_id && matchIds.has(hr.tournament_match_id)),
    );

    // Raw hole points (what the hole-by-hole play produced).
    const totals = calcTeamTotals(roundResults, teamIds);
    const a = totals[teamA.id] || 0;
    const b = totals[teamB.id] || 0;

    const isCompleted = r.status === 'completed';
    const award = calcRoundTeamAward(
      r, { [teamA.id]: a, [teamB.id]: b }, roundResults, [teamA.id, teamB.id],
      teamScoringMethod, customRoundPoints, isCompleted
    );
    const awardedA = award[teamA.id] || 0;
    const awardedB = award[teamB.id] || 0;

    // Front/Back/Overall segment split (only meaningful for fbo mode).
    let segments: { label: string; a: number; b: number }[] = [];
    if (isCompleted && teamScoringMethod === 'custom_pts_per_round' && r.team_scoring_mode === 'fbo') {
      const sum = (from: number, to: number) => {
        let sa = 0, sb = 0;
        roundResults.forEach((hr: any) => {
          if (hr.hole_number >= from && hr.hole_number <= to) {
            const tp = (hr.team_points || {}) as Record<string, number>;
            sa += Number(tp[teamA.id] || 0);
            sb += Number(tp[teamB.id] || 0);
          }
        });
        return [sa, sb] as const;
      };
      const [fa, fb] = sum(1, 9);
      const [ba, bb] = sum(10, 18);
      const pts = (r.team_scoring_points || {}) as Record<string, number>;
      const [oa, ob] = [a, b];
      const win = (sa: number, sb: number) =>
        sa > sb ? teamA.name : sb > sa ? teamB.name : 'Halved';
      segments = [
        { label: `Front (${pts.front ?? 1}pt)`, a: sa_pts(fa, fb, pts.front ?? 1), b: sa_pts(fb, fa, pts.front ?? 1) },
        { label: `Back (${pts.back ?? 1}pt)`, a: sa_pts(ba, bb, pts.back ?? 1), b: sa_pts(bb, ba, pts.back ?? 1) },
        { label: `Overall (${pts.overall ?? 2}pt)`, a: sa_pts(oa, ob, pts.overall ?? 2), b: sa_pts(ob, oa, pts.overall ?? 2) },
      ];
      void win;
    } else if (teamScoringMethod === 'custom_pts_per_round' && r.team_scoring_mode === 'per_match') {
      const { matches: matchRows } = calcRoundMatchAward(
        roundResults as any,
        [teamA.id, teamB.id],
        (r.team_scoring_points || {}) as any,
      );
      // Label each unit with the real match number (or group number) it maps to.
      const unitLabel = (unitId: string, isMatch: boolean, idx: number) => {
        if (isMatch) {
          const m = matchesForRound.find((x: any) => x.id === unitId);
          return `Match ${m?.matchNumber ?? idx + 1}`;
        }
        const g = roundGroups.find((x: any) => x.id === unitId);
        return `Group ${g?.group_number ?? idx + 1}`;
      };
      const suffix = isCompleted ? '' : ' (in progress)';
      segments = matchRows.map((m, idx) => ({
        label: `${unitLabel(m.unitId, m.isMatch, idx)}${suffix}`,
        a: m.awardA,
        b: m.awardB,
      }));
      const num = (s: string) => Number(s.replace(/\D+/g, '')) || 0;
      segments.sort((x, y) => num(x.label) - num(y.label));
    }




    // Awarded points sum into the grand total; live rounds fall back to raw.
    grandA += awardedA;
    grandB += awardedB;

    return { round: r, roundGroups, matchesForRound, a, b, awardedA, awardedB, segments, isActive: r.status === 'active' };
  });

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider">Round</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider" style={{ color: teamA.color }}>{teamA.name}</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider" style={{ color: teamB.color }}>{teamB.name}</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roundData.map(({ round, roundGroups, matchesForRound, a, b, awardedA, awardedB, segments, isActive }) => (
              <React.Fragment key={round.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggle(round.id)}
                >
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1">
                      {expanded.has(round.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {round.name || `Round ${round.round_number}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-mono text-sm">{awardedA}</div>
                    <div className="text-[10px] text-muted-foreground">raw {a}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-mono text-sm">{awardedB}</div>
                    <div className="text-[10px] text-muted-foreground">raw {b}</div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
                      </span>
                    ) : awardedA > awardedB ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA.color }} />
                        <span className="text-xs font-medium">{teamA.name}</span>
                      </span>
                    ) : awardedB > awardedA ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB.color }} />
                        <span className="text-xs font-medium">{teamB.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">½ Halved</span>
                    )}
                  </TableCell>
                </TableRow>

                {segments.length > 0 && (
                  <TableRow className="bg-muted/20">
                    <TableCell className="pl-8 text-[11px] text-muted-foreground">Award points</TableCell>
                    <TableCell className="text-center text-[11px]">
                      {segments.map((s) => (
                        <div key={s.label} className="flex items-center justify-center gap-1">
                          <span className="font-mono">{s.a}</span>
                          <span className="text-muted-foreground/70">·</span>
                          <span className="font-mono">{s.b}</span>
                          <span className="text-muted-foreground/70"> {s.label}</span>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-[10px] text-muted-foreground text-center">per segment</TableCell>
                  </TableRow>
                )}

                {expanded.has(round.id) && (
                  matchesForRound.length > 0
                    ? matchesForRound.map((m: any) => {
                        const mResults = holeResults.filter((hr: any) => hr.tournament_match_id === m.id);
                        const t = calcTeamTotals(mResults, teamIds);
                        const ma = t[teamA.id] || 0;
                        const mb = t[teamB.id] || 0;
                        const namesFor = (ids: string[]) =>
                          ids
                            .map((id: string) => players.find((p: any) => p.id === id))
                            .map((p: any) => (p ? p.display_name.split(' ')[0] : '?'))
                            .join(', ');
                        const sideAIsTeamA = !m.teamAId || m.teamAId === teamA.id;
                        const aNames = namesFor(sideAIsTeamA ? m.sideA : m.sideB);
                        const bNames = namesFor(sideAIsTeamA ? m.sideB : m.sideA);
                        return (
                          <TableRow key={m.id} className="bg-muted/10">
                            <TableCell className="pl-8 text-xs text-muted-foreground">
                              <span>Match {m.matchNumber}: </span>
                              <span>{aNames} vs {bNames}</span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{ma}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{mb}</TableCell>
                            <TableCell className="text-center">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                ma > mb ? 'bg-success/20 text-success' :
                                mb > ma ? 'bg-destructive/20 text-destructive' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {ma > mb ? teamA.name : mb > ma ? teamB.name : '½'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    : roundGroups.map((g: any) => (
                        <GroupResultRow
                          key={g.id}
                          group={g}
                          teamA={teamA}
                          teamB={teamB}
                          groupPlayers={groupPlayers[g.id] || []}
                          players={players}
                          holeResults={holeResults.filter((hr: any) => hr.tournament_group_id === g.id)}
                          joinCode={joinCode}
                          roundId={round.id}
                        />
                      ))
                )}
              </React.Fragment>
            ))}

            <TableRow className="bg-muted/40">
              <TableCell className="font-semibold text-sm">Total</TableCell>
              <TableCell className="text-center font-mono text-sm font-semibold" style={{ color: teamA.color }}>{grandA}</TableCell>
              <TableCell className="text-center font-mono text-sm font-semibold" style={{ color: teamB.color }}>{grandB}</TableCell>
              <TableCell className="text-center text-xs">
                {grandA > grandB ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA.color }} />
                    <span className="font-medium">{teamA.name} leads</span>
                  </span>
                ) : grandB > grandA ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB.color }} />
                    <span className="font-medium">{teamB.name} leads</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">All Square</span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default TeamRoundResultScoreboard;

// Points awarded for winning a segment (winner takes the segment points, loser 0).
function sa_pts(mine: number, theirs: number, pts: number): number {
  if (mine > theirs) return pts;
  if (mine < theirs) return 0;
  return pts / 2;
}
