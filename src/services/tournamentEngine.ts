/**
 * Tournament Scoring Engine — Piece 4
 *
 * Calculates hole-by-hole results and match state for all 9 tournament game types.
 * Pure functions — no side effects, no Supabase calls.
 */

import type {
  TournamentPlayer,
  TournamentGame,
  TournamentHolePoints,
  HalvedHoleRule,
  MatchState,
} from '@/types/tournament';

// ── OUTPUT TYPES ─────────────────────────────────────────────

export interface HoleResult {
  holeNumber: number;
  teamPoints: Record<string, number>;
  playerPoints: Record<string, number>;
  pointsValue: number;
  resultLabel: string;
  grossScores: Record<string, number>;
  netScores: Record<string, number>;
}

export interface RoundResult {
  groupId: string;
  holeResults: HoleResult[];
  teamTotals: Record<string, number>;
  playerTotals: Record<string, number>;
  matchState: MatchState;
}

export interface CourseHole {
  number: number;
  par: number;
  handicapIndex: number;
}

export interface EngineInput {
  game: TournamentGame;
  holePointOverrides: TournamentHolePoints[];
  players: TournamentPlayer[];
  teamAssignments: Record<string, string>; // tournamentPlayerId → teamId
  scores: Record<string, Record<number, number>>; // scores[playerId][hole] = gross
  courseHoles: CourseHole[];
  teamNames?: Record<string, string>; // teamId → display name
  subMatchups?: { playerA: string; playerB: string }[]; // for 4-player 1v1 groups
}

// ── UTILITY FUNCTIONS ────────────────────────────────────────

export function getEffectiveHandicap(player: TournamentPlayer): number {
  return player.handicapOverride ?? player.handicapIndex;
}

export function calcCourseHandicap(handicapIndex: number): number {
  return Math.round(handicapIndex);
}

export function strokesReceived(courseHandicap: number, holeHandicapIndex: number): number {
  if (courseHandicap <= 0) return 0;
  const base = Math.floor(courseHandicap / 18);
  const remainder = courseHandicap % 18;
  return base + (holeHandicapIndex <= remainder ? 1 : 0);
}

export function matchPlayStrokeDifference(
  players: TournamentPlayer[],
  game: TournamentGame,
  holeHandicapIndex: number,
): Record<string, number> {
  if (!game.useHandicaps) {
    return Object.fromEntries(players.map(p => [p.id, 0]));
  }
  const handicaps = players.map(p => ({
    id: p.id,
    ch: calcCourseHandicap(
      getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100),
    ),
  }));
  const minHandicap = Math.min(...handicaps.map(h => h.ch));
  return Object.fromEntries(
    handicaps.map(h => [h.id, strokesReceived(h.ch - minHandicap, holeHandicapIndex)]),
  );
}

export function netScore(gross: number, strokes: number): number {
  return gross - strokes;
}

export function holePointValue(
  holeNumber: number,
  game: TournamentGame,
  overrides: TournamentHolePoints[],
): number {
  const o = overrides.find(h => h.holeNumber === holeNumber);
  return o ? o.points : game.defaultPointsPerHole;
}

export function halvedPoints(pointValue: number, rule: HalvedHoleRule): number {
  return rule === 'half_point' ? pointValue / 2 : 0;
}

// ── MATCH STATE ──────────────────────────────────────────────

export function calcMatchState(
  holeResults: HoleResult[],
  teamAId: string,
  teamBId: string,
  totalHoles: number,
): MatchState {
  const teamATotal = holeResults.reduce((s, h) => s + (h.teamPoints[teamAId] || 0), 0);
  const teamBTotal = holeResults.reduce((s, h) => s + (h.teamPoints[teamBId] || 0), 0);

  const holesPlayed = holeResults.length;
  const holesRemaining = totalHoles - holesPlayed;
  const diff = Math.abs(teamATotal - teamBTotal);
  const leadingTeamId =
    teamATotal > teamBTotal ? teamAId : teamBTotal > teamATotal ? teamBId : undefined;

  const isComplete =
    holesPlayed === totalHoles ||
    (leadingTeamId !== undefined && diff > holesRemaining);

  const isDormie =
    !isComplete && leadingTeamId !== undefined && diff === holesRemaining;

  let resultLabel = '';
  if (holesPlayed === 0) {
    resultLabel = 'All Square';
  } else if (isComplete && diff === 0) {
    resultLabel = 'Halved';
  } else if (!leadingTeamId) {
    resultLabel = 'All Square';
  } else if (isComplete && holesPlayed < totalHoles) {
    resultLabel = `Wins ${diff}&${holesRemaining}`;
  } else if (isComplete) {
    resultLabel = diff === 0 ? 'Halved' : `Wins ${diff} UP`;
  } else if (isDormie) {
    resultLabel = `Dormie ${diff}`;
  } else {
    resultLabel = `${diff} UP — Thru ${holesPlayed}`;
  }

  return {
    holesPlayed,
    leadingTeamId,
    leadAmount: diff,
    holesRemaining,
    isComplete,
    isDormie,
    resultLabel,
    teamTotals: { [teamAId]: teamATotal, [teamBId]: teamBTotal },
  };
}

// ── HELPERS ──────────────────────────────────────────────────

function getTeamIds(teamAssignments: Record<string, string>): [string, string] {
  const ids = [...new Set(Object.values(teamAssignments))];
  return [ids[0], ids[1] || ids[0]];
}

function deriveSubMatchups(
  players: TournamentPlayer[],
  teamAssignments: Record<string, string>,
): { playerA: string; playerB: string }[] {
  const byTeam: Record<string, string[]> = {};
  players.forEach(p => {
    const tid = teamAssignments[p.id];
    if (!byTeam[tid]) byTeam[tid] = [];
    byTeam[tid].push(p.id);
  });
  const teamIds = Object.keys(byTeam);
  if (teamIds.length < 2) return [{ playerA: players[0].id, playerB: players[1].id }];
  const teamA = byTeam[teamIds[0]];
  const teamB = byTeam[teamIds[1]];
  const matchups: { playerA: string; playerB: string }[] = [];
  const count = Math.min(teamA.length, teamB.length);
  for (let i = 0; i < count; i++) {
    matchups.push({ playerA: teamA[i], playerB: teamB[i] });
  }
  return matchups;
}

function mergeSubMatchResults(
  subResults: RoundResult[],
  totalHoles: number,
  teamAssignments: Record<string, string>,
): RoundResult {
  if (subResults.length === 1) return subResults[0];

  const mergedHoleMap: Record<number, HoleResult> = {};
  const teamTotals: Record<string, number> = {};
  const playerTotals: Record<string, number> = {};

  for (const result of subResults) {
    for (const hr of result.holeResults) {
      if (!mergedHoleMap[hr.holeNumber]) {
        mergedHoleMap[hr.holeNumber] = { ...hr };
      } else {
        const existing = mergedHoleMap[hr.holeNumber];
        // Sum team points
        Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
          existing.teamPoints[tid] = (existing.teamPoints[tid] || 0) + pts;
        });
        // Union player points
        Object.entries(hr.playerPoints).forEach(([pid, pts]) => {
          existing.playerPoints[pid] = (existing.playerPoints[pid] || 0) + pts;
        });
        // Union scores
        Object.entries(hr.grossScores).forEach(([pid, s]) => { existing.grossScores[pid] = s; });
        Object.entries(hr.netScores).forEach(([pid, s]) => { existing.netScores[pid] = s; });
        // Sum points value
        existing.pointsValue += hr.pointsValue;
        // Concat labels
        existing.resultLabel = [existing.resultLabel, hr.resultLabel].filter(Boolean).join(' · ');
      }
    }
    Object.entries(result.teamTotals).forEach(([tid, pts]) => {
      teamTotals[tid] = (teamTotals[tid] || 0) + pts;
    });
    Object.entries(result.playerTotals).forEach(([pid, pts]) => {
      playerTotals[pid] = (playerTotals[pid] || 0) + pts;
    });
  }

  const holeResults = Object.values(mergedHoleMap).sort((a, b) => a.holeNumber - b.holeNumber);
  const [teamAId, teamBId] = getTeamIds(teamAssignments);

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults, teamAId, teamBId, totalHoles),
  };
}

function splitByTeam(
  players: TournamentPlayer[],
  teamAssignments: Record<string, string>,
): Record<string, TournamentPlayer[]> {
  const map: Record<string, TournamentPlayer[]> = {};
  players.forEach(p => {
    const tid = teamAssignments[p.id];
    if (!map[tid]) map[tid] = [];
    map[tid].push(p);
  });
  return map;
}

function maxScoreForHole(game: TournamentGame, par: number): number {
  return game.maxScorePerHole ? par + game.maxScorePerHole : Infinity;
}

// ── 1. INDIVIDUAL MATCH PLAY ─────────────────────────────────

export function calcMatchPlayIndividual(input: EngineInput): RoundResult {
  const { game, holePointOverrides, players, teamAssignments, scores, courseHoles, subMatchups } = input;

  // If >2 players, run sub-matchups and merge
  if (players.length > 2) {
    const matchups = subMatchups && subMatchups.length > 0
      ? subMatchups
      : deriveSubMatchups(players, teamAssignments);

    const subResults = matchups.map(m => {
      const pA = players.find(p => p.id === m.playerA);
      const pB = players.find(p => p.id === m.playerB);
      if (!pA || !pB) return null;
      return calcMatchPlayIndividual({
        ...input,
        players: [pA, pB],
        subMatchups: undefined, // prevent recursion
      });
    }).filter((r): r is RoundResult => r !== null);

    return mergeSubMatchResults(subResults, courseHoles.length, teamAssignments);
  }

  const [p1, p2] = players;
  const p1Team = teamAssignments[p1.id];
  const p2Team = teamAssignments[p2.id];

  const teamTotals: Record<string, number> = { [p1Team]: 0, [p2Team]: 0 };
  const playerTotals: Record<string, number> = { [p1.id]: 0, [p2.id]: 0 };
  const holeResults: HoleResult[] = [];

  for (const hole of courseHoles) {
    const p1Gross = scores[p1.id]?.[hole.number];
    const p2Gross = scores[p2.id]?.[hole.number];
    if (p1Gross === undefined || p2Gross === undefined) continue;

    const max = maxScoreForHole(game, hole.par);
    const p1Adj = Math.min(p1Gross, max);
    const p2Adj = Math.min(p2Gross, max);

    const sd = matchPlayStrokeDifference(players, game, hole.handicapIndex);
    const p1Net = netScore(p1Adj, sd[p1.id]);
    const p2Net = netScore(p2Adj, sd[p2.id]);

    const pv = holePointValue(hole.number, game, holePointOverrides);
    let p1Pts = 0, p2Pts = 0, label = '';

    if (p1Net < p2Net) {
      p1Pts = pv;
      label = `${p1.displayName} wins`;
    } else if (p2Net < p1Net) {
      p2Pts = pv;
      label = `${p2.displayName} wins`;
    } else {
      const hp = halvedPoints(pv, game.halvedHoleRule);
      p1Pts = hp; p2Pts = hp;
      label = hp > 0 ? 'Halved' : 'No points';
    }

    teamTotals[p1Team] += p1Pts;
    teamTotals[p2Team] += p2Pts;
    playerTotals[p1.id] += p1Pts;
    playerTotals[p2.id] += p2Pts;

    holeResults.push({
      holeNumber: hole.number,
      teamPoints: { [p1Team]: p1Pts, [p2Team]: p2Pts },
      playerPoints: { [p1.id]: p1Pts, [p2.id]: p2Pts },
      pointsValue: pv,
      resultLabel: label,
      grossScores: { [p1.id]: p1Adj, [p2.id]: p2Adj },
      netScores: { [p1.id]: p1Net, [p2.id]: p2Net },
    });
  }

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults, p1Team, p2Team, courseHoles.length),
  };
}

// ── 2. BEST BALL MATCH PLAY (2v2) ───────────────────────────

export function calcMatchPlayBestBall(input: EngineInput): RoundResult {
  const { game, holePointOverrides, players, teamAssignments, scores, courseHoles } = input;
  const [teamAId, teamBId] = getTeamIds(teamAssignments);
  const teamPlayers = splitByTeam(players, teamAssignments);

  const teamTotals: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };
  const playerTotals: Record<string, number> = {};
  players.forEach(p => { playerTotals[p.id] = 0; });
  const holeResults: HoleResult[] = [];

  for (const hole of courseHoles) {
    const max = maxScoreForHole(game, hole.par);
    const sd = matchPlayStrokeDifference(players, game, hole.handicapIndex);

    const getTeamNets = (tid: string): number[] =>
      (teamPlayers[tid] || [])
        .map(p => {
          const g = scores[p.id]?.[hole.number];
          if (g === undefined) return Infinity;
          return netScore(Math.min(g, max), sd[p.id]);
        })
        .sort((a, b) => a - b);

    const aNets = getTeamNets(teamAId);
    const bNets = getTeamNets(teamBId);
    if (aNets.includes(Infinity) || bNets.includes(Infinity)) continue;

    const pv = holePointValue(hole.number, game, holePointOverrides);
    let aPts = 0, bPts = 0, label = '';

    const nameA = input.teamNames?.[teamAId] || 'Team A';
    const nameB = input.teamNames?.[teamBId] || 'Team B';

    if (aNets[0] < bNets[0]) {
      aPts = pv; label = `${nameA} wins`;
    } else if (bNets[0] < aNets[0]) {
      bPts = pv; label = `${nameB} wins`;
    } else if (game.secondBallTiebreaker && aNets[1] !== undefined && bNets[1] !== undefined) {
      if (aNets[1] < bNets[1]) { aPts = pv; label = `${nameA} wins (2nd ball)`; }
      else if (bNets[1] < aNets[1]) { bPts = pv; label = `${nameB} wins (2nd ball)`; }
      else { const hp = halvedPoints(pv, game.halvedHoleRule); aPts = hp; bPts = hp; label = hp > 0 ? 'Halved' : 'No points'; }
    } else {
      const hp = halvedPoints(pv, game.halvedHoleRule);
      aPts = hp; bPts = hp;
      label = hp > 0 ? 'Halved' : 'No points';
    }

    teamTotals[teamAId] += aPts;
    teamTotals[teamBId] += bPts;

    (teamPlayers[teamAId] || []).forEach(p => { playerTotals[p.id] += aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { playerTotals[p.id] += bPts; });

    const grossScores: Record<string, number> = {};
    const netScores: Record<string, number> = {};
    players.forEach(p => {
      const g = scores[p.id]?.[hole.number];
      if (g !== undefined) {
        grossScores[p.id] = Math.min(g, max);
        netScores[p.id] = netScore(grossScores[p.id], sd[p.id]);
      }
    });

    const holePlayerPoints: Record<string, number> = {};
    (teamPlayers[teamAId] || []).forEach(p => { holePlayerPoints[p.id] = aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { holePlayerPoints[p.id] = bPts; });

    holeResults.push({
      holeNumber: hole.number,
      teamPoints: { [teamAId]: aPts, [teamBId]: bPts },
      playerPoints: holePlayerPoints,
      pointsValue: pv,
      resultLabel: label,
      grossScores,
      netScores,
    });
  }

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults, teamAId, teamBId, courseHoles.length),
  };
}

// ── 3. GROSS BEST BALL (6/6/6) ──────────────────────────────

function scoresNeeded(holeNumber: number): number {
  if (holeNumber <= 6) return 2;
  if (holeNumber <= 12) return 3;
  return 4;
}

export function calcGrossBestBall(input: EngineInput): RoundResult {
  const { game, holePointOverrides, players, teamAssignments, scores, courseHoles } = input;
  const [teamAId, teamBId] = getTeamIds(teamAssignments);
  const teamPlayers = splitByTeam(players, teamAssignments);

  const teamTotals: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };
  const playerTotals: Record<string, number> = {};
  players.forEach(p => { playerTotals[p.id] = 0; });
  const holeResults: HoleResult[] = [];

  for (const hole of courseHoles) {
    const max = maxScoreForHole(game, hole.par);
    const sd = game.useHandicaps
      ? matchPlayStrokeDifference(players, game, hole.handicapIndex)
      : Object.fromEntries(players.map(p => [p.id, 0]));

    const n = scoresNeeded(hole.number);

    const getTeamSum = (tid: string): number | null => {
      const teamScrs = (teamPlayers[tid] || []).map(p => {
        const g = scores[p.id]?.[hole.number];
        if (g === undefined) return null;
        const adj = Math.min(g, max);
        return game.useHandicaps ? netScore(adj, sd[p.id]) : adj;
      });
      if (teamScrs.includes(null)) return null;
      return (teamScrs as number[]).sort((a, b) => a - b).slice(0, n).reduce((s, v) => s + v, 0);
    };

    const aSum = getTeamSum(teamAId);
    const bSum = getTeamSum(teamBId);
    if (aSum === null || bSum === null) continue;

    const pv = holePointValue(hole.number, game, holePointOverrides);
    let aPts = 0, bPts = 0, label = '';

    const nameA = input.teamNames?.[teamAId] || 'Team A';
    const nameB = input.teamNames?.[teamBId] || 'Team B';
    if (aSum < bSum) { aPts = pv; label = `${nameA} wins (${aSum} vs ${bSum})`; }
    else if (bSum < aSum) { bPts = pv; label = `${nameB} wins (${bSum} vs ${aSum})`; }
    else { const hp = halvedPoints(pv, game.halvedHoleRule); aPts = hp; bPts = hp; label = hp > 0 ? 'Halved' : 'No points'; }

    teamTotals[teamAId] += aPts;
    teamTotals[teamBId] += bPts;
    (teamPlayers[teamAId] || []).forEach(p => { playerTotals[p.id] += aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { playerTotals[p.id] += bPts; });

    const grossScores: Record<string, number> = {};
    const netScores: Record<string, number> = {};
    players.forEach(p => {
      const g = scores[p.id]?.[hole.number];
      if (g !== undefined) {
        grossScores[p.id] = Math.min(g, max);
        netScores[p.id] = game.useHandicaps ? netScore(grossScores[p.id], sd[p.id]) : grossScores[p.id];
      }
    });

    const holePlayerPoints: Record<string, number> = {};
    (teamPlayers[teamAId] || []).forEach(p => { holePlayerPoints[p.id] = aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { holePlayerPoints[p.id] = bPts; });

    holeResults.push({
      holeNumber: hole.number,
      teamPoints: { [teamAId]: aPts, [teamBId]: bPts },
      playerPoints: holePlayerPoints,
      pointsValue: pv,
      resultLabel: label,
      grossScores,
      netScores,
    });
  }

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults, teamAId, teamBId, courseHoles.length),
  };
}

export const calcBlindGrossBestBall = calcGrossBestBall;

// ── 4. SCRAMBLE (2-man / 4-man) ──────────────────────────────

export function calcScramble(input: EngineInput): RoundResult {
  const { game, holePointOverrides, players, teamAssignments, scores, courseHoles } = input;
  const [teamAId, teamBId] = getTeamIds(teamAssignments);
  const teamPlayers = splitByTeam(players, teamAssignments);

  const teamTotals: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };
  const playerTotals: Record<string, number> = {};
  players.forEach(p => { playerTotals[p.id] = 0; });
  const holeResults: HoleResult[] = [];

  for (const hole of courseHoles) {
    const max = maxScoreForHole(game, hole.par);

    const getTeamScore = (tid: string): number | null => {
      const first = (teamPlayers[tid] || [])[0];
      if (!first) return null;
      const g = scores[first.id]?.[hole.number];
      if (g === undefined) return null;
      const adj = Math.min(g, max);
      if (!game.useHandicaps) return adj;
      const scrambleHcp = Math.round(
        (teamPlayers[tid] || []).reduce((sum, p) =>
          sum + calcCourseHandicap(getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100)), 0) * 0.25,
      );
      return netScore(adj, strokesReceived(scrambleHcp, hole.handicapIndex));
    };

    const aScore = getTeamScore(teamAId);
    const bScore = getTeamScore(teamBId);
    if (aScore === null || bScore === null) continue;

    const pv = holePointValue(hole.number, game, holePointOverrides);
    let aPts = 0, bPts = 0, label = '';

    const nameA = input.teamNames?.[teamAId] || 'Team A';
    const nameB = input.teamNames?.[teamBId] || 'Team B';
    if (aScore < bScore) { aPts = pv; label = `${nameA} wins`; }
    else if (bScore < aScore) { bPts = pv; label = `${nameB} wins`; }
    else { const hp = halvedPoints(pv, game.halvedHoleRule); aPts = hp; bPts = hp; label = hp > 0 ? 'Halved' : 'No points'; }

    teamTotals[teamAId] += aPts;
    teamTotals[teamBId] += bPts;
    (teamPlayers[teamAId] || []).forEach(p => { playerTotals[p.id] += aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { playerTotals[p.id] += bPts; });

    const grossScores: Record<string, number> = {};
    players.forEach(p => {
      const g = scores[p.id]?.[hole.number];
      if (g !== undefined) grossScores[p.id] = Math.min(g, max);
    });

    const holePlayerPoints: Record<string, number> = {};
    (teamPlayers[teamAId] || []).forEach(p => { holePlayerPoints[p.id] = aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { holePlayerPoints[p.id] = bPts; });

    holeResults.push({
      holeNumber: hole.number,
      teamPoints: { [teamAId]: aPts, [teamBId]: bPts },
      playerPoints: holePlayerPoints,
      pointsValue: pv,
      resultLabel: label,
      grossScores,
      netScores: grossScores,
    });
  }

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults, teamAId, teamBId, courseHoles.length),
  };
}

// ── 5. ALTERNATE SHOT ────────────────────────────────────────

export function calcAlternateShot(input: EngineInput): RoundResult {
  const { game, players, teamAssignments, courseHoles } = input;
  const [teamAId, teamBId] = getTeamIds(teamAssignments);
  const teamPlayers = splitByTeam(players, teamAssignments);

  const teamHandicaps: Record<string, number> = {};
  [teamAId, teamBId].forEach(tid => {
    teamHandicaps[tid] = Math.round(
      (teamPlayers[tid] || []).reduce((sum, p) =>
        sum + calcCourseHandicap(getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100)), 0) * 0.5,
    );
  });

  const minHcp = Math.min(teamHandicaps[teamAId], teamHandicaps[teamBId]);
  const teamDiffs: Record<string, number> = {
    [teamAId]: teamHandicaps[teamAId] - minHcp,
    [teamBId]: teamHandicaps[teamBId] - minHcp,
  };

  // Pre-adjust scores by team-level strokes, then delegate to scramble with handicaps off
  const adjustedScores: Record<string, Record<number, number>> = {};
  players.forEach(p => {
    const tid = teamAssignments[p.id];
    adjustedScores[p.id] = {};
    courseHoles.forEach(hole => {
      const g = input.scores[p.id]?.[hole.number];
      if (g !== undefined) {
        adjustedScores[p.id][hole.number] = g - strokesReceived(teamDiffs[tid], hole.handicapIndex);
      }
    });
  });

  return calcScramble({
    ...input,
    game: { ...game, useHandicaps: false },
    scores: adjustedScores,
  });
}

// ── 6. TOURNAMENT SIXES ─────────────────────────────────────

export function calcTournamentSixes(input: EngineInput): RoundResult {
  const { game } = input;

  if (game.sixesFormat === 'sum_of_strokes') {
    return calcSixesSumOfStrokes(input);
  }
  // Default: match play per hole — use best ball logic
  return calcMatchPlayBestBall(input);
}

function calcSixesSumOfStrokes(input: EngineInput): RoundResult {
  const { game, players, teamAssignments, scores, courseHoles } = input;
  const [teamAId, teamBId] = getTeamIds(teamAssignments);
  const teamPlayers = splitByTeam(players, teamAssignments);

  const teamTotals: Record<string, number> = { [teamAId]: 0, [teamBId]: 0 };
  const playerTotals: Record<string, number> = {};
  players.forEach(p => { playerTotals[p.id] = 0; });
  const holeResults: HoleResult[] = [];

  const segments = [
    { holes: courseHoles.filter(h => h.number <= 6), index: 0 },
    { holes: courseHoles.filter(h => h.number >= 7 && h.number <= 12), index: 1 },
    { holes: courseHoles.filter(h => h.number >= 13), index: 2 },
  ];

  const segPts = game.sixesSegmentPoints || [1, 1, 1];

  for (const seg of segments) {
    const pointValue = segPts[seg.index];
    const allScored = seg.holes.every(h => players.every(p => scores[p.id]?.[h.number] !== undefined));
    if (!allScored) {
      // Still push placeholder results for scored holes
      seg.holes.forEach(hole => {
        const grossScores: Record<string, number> = {};
        const netScoresMap: Record<string, number> = {};
        players.forEach(p => {
          const g = scores[p.id]?.[hole.number];
          if (g !== undefined) {
            grossScores[p.id] = g;
            netScoresMap[p.id] = game.useHandicaps
              ? netScore(g, strokesReceived(calcCourseHandicap(getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100)), hole.handicapIndex))
              : g;
          }
        });
        holeResults.push({
          holeNumber: hole.number,
          teamPoints: { [teamAId]: 0, [teamBId]: 0 },
          playerPoints: {},
          pointsValue: 0,
          resultLabel: '',
          grossScores,
          netScores: netScoresMap,
        });
      });
      continue;
    }

    const getTeamSum = (tid: string): number =>
      seg.holes.reduce((total, hole) => {
        const max = maxScoreForHole(game, hole.par);
        return total + (teamPlayers[tid] || []).reduce((ts, p) => {
          const g = Math.min(scores[p.id]![hole.number], max);
          const n = game.useHandicaps
            ? netScore(g, strokesReceived(calcCourseHandicap(getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100)), hole.handicapIndex))
            : g;
          return ts + n;
        }, 0);
      }, 0);

    const aSum = getTeamSum(teamAId);
    const bSum = getTeamSum(teamBId);

    let aPts = 0, bPts = 0, label = '';
    const nameA = input.teamNames?.[teamAId] || 'Team A';
    const nameB = input.teamNames?.[teamBId] || 'Team B';
    if (aSum < bSum) { aPts = pointValue; label = `${nameA} wins segment (${aSum} vs ${bSum})`; }
    else if (bSum < aSum) { bPts = pointValue; label = `${nameB} wins segment (${bSum} vs ${aSum})`; }
    else { const hp = halvedPoints(pointValue, game.halvedHoleRule); aPts = hp; bPts = hp; label = hp > 0 ? 'Halved' : 'No points'; }

    teamTotals[teamAId] += aPts;
    teamTotals[teamBId] += bPts;
    (teamPlayers[teamAId] || []).forEach(p => { playerTotals[p.id] += aPts; });
    (teamPlayers[teamBId] || []).forEach(p => { playerTotals[p.id] += bPts; });

    const lastHole = seg.holes[seg.holes.length - 1];
    seg.holes.forEach(hole => {
      const isLast = hole.number === lastHole.number;
      const grossScores: Record<string, number> = {};
      const netScoresMap: Record<string, number> = {};
      players.forEach(p => {
        const g = scores[p.id]?.[hole.number];
        if (g !== undefined) {
          grossScores[p.id] = g;
          netScoresMap[p.id] = game.useHandicaps
            ? netScore(g, strokesReceived(calcCourseHandicap(getEffectiveHandicap(p) * ((game.handicapAllowancePercent ?? 100) / 100)), hole.handicapIndex))
            : g;
        }
      });
      holeResults.push({
        holeNumber: hole.number,
        teamPoints: isLast ? { [teamAId]: aPts, [teamBId]: bPts } : { [teamAId]: 0, [teamBId]: 0 },
        playerPoints: {},
        pointsValue: isLast ? pointValue : 0,
        resultLabel: isLast ? label : '',
        grossScores,
        netScores: netScoresMap,
      });
    });
  }

  return {
    groupId: '',
    holeResults,
    teamTotals,
    playerTotals,
    matchState: calcMatchState(holeResults.filter(h => h.pointsValue > 0), teamAId, teamBId, 3), // 3 segments
  };
}

// ── MAIN DISPATCH ────────────────────────────────────────────

export function calcTournamentHoleResults(input: EngineInput): RoundResult {
  switch (input.game.gameType) {
    case 'match_play_individual':
      return calcMatchPlayIndividual(input);
    case 'match_play_best_ball':
      return calcMatchPlayBestBall(input);
    case 'match_play_gross_best_ball':
    case 'blind_gross_best_ball':
      return calcGrossBestBall(input);
    case 'scramble_2':
    case 'scramble_4':
      return calcScramble(input);
    case 'alternate_shot_twosomes':
    case 'alternate_shot_foursomes':
      return calcAlternateShot(input);
    case 'tournament_sixes':
      return calcTournamentSixes(input);
    default:
      throw new Error(`Unknown tournament game type: ${input.game.gameType}`);
  }
}
