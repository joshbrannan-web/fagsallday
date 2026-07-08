import { Round, GameSettings, GameResult, Player } from "../types";
import { getPlayedHoles, getPlayOrder, getHoleByPlayOrder } from "../lib/holeOrder";

// ---- Segment helpers (Team Hammer) ----

export type HammerSegmentLength = 3 | 6 | 18;

const roundStart = (round: Round): number => (round as any).startHole || 1;

export const getHammerSegmentLength = (game: GameSettings): HammerSegmentLength => {
  return (game.config.hammer?.segmentLength ?? 18) as HammerSegmentLength;
};

export const getHammerVariant = (game: GameSettings): 'team' | 'lr' => {
  return game.config.hammer?.variant ?? 'team';
};

// Segment (1-based) for a physical hole given round startHole and segment length.
export const getHammerSegmentForHole = (hole: number, segLen: HammerSegmentLength, startHole: number = 1): number => {
  if (segLen === 18) return 1;
  const pos = getPlayOrder(hole, startHole);
  return Math.floor((pos - 1) / segLen) + 1;
};

// Physical hole number where a segment starts (first played hole of the segment).
export const getHammerSegmentStartHole = (segment: number, segLen: HammerSegmentLength, startHole: number = 1): number => {
  if (segLen === 18) return getHoleByPlayOrder(1, startHole);
  const pos = (segment - 1) * segLen + 1;
  return getHoleByPlayOrder(pos, startHole);
};

export const getHammerSegmentHoles = (segment: number, segLen: HammerSegmentLength, startHole: number = 1): number[] => {
  const played = getPlayedHoles(startHole);
  if (segLen === 18) return played;
  const startIdx = (segment - 1) * segLen;
  const endIdx = Math.min(startIdx + segLen, 18);
  return played.slice(startIdx, endIdx);
};

export const isHammerSegmentStartHole = (hole: number, segLen: HammerSegmentLength, startHole: number = 1): boolean => {
  const pos = getPlayOrder(hole, startHole);
  if (segLen === 18) return pos === 1;
  return ((pos - 1) % segLen) === 0;
};

export const getHammerAllSegments = (segLen: HammerSegmentLength): number[] => {
  if (segLen === 18) return [1];
  const total = Math.ceil(18 / segLen);
  return Array.from({ length: total }, (_, i) => i + 1);
};

// ---- Team Assignment readers ----

export interface HammerTeamAssignment {
  teamA: string[];
  teamB: string[];
}

export const getHammerTeamAssignment = (
  gameData: any,
  gameId: string,
  segment: number,
  segLen: HammerSegmentLength,
  startHole: number = 1,
): HammerTeamAssignment | null => {
  const segStartHole = getHammerSegmentStartHole(segment, segLen, startHole);
  const data = gameData?.[gameId]?.[segStartHole];
  if (!data?._META_TEAM_A || !data?._META_TEAM_B) return null;
  return { teamA: data._META_TEAM_A, teamB: data._META_TEAM_B };
};

// LR per-hole reader; returns { teamA, teamB, solo? } where teamA/B are player ID arrays
export interface HammerHoleTeams {
  teamA: string[]; // pair (or 2v2 team A)
  teamB: string[]; // pair partner OR solo (1 ID for 2v1)
  solo?: string;   // for 2v1
}

export const getHammerHoleTeams = (
  gameData: any,
  gameId: string,
  hole: number,
  variant: 'team' | 'lr',
  segLen: HammerSegmentLength,
): HammerHoleTeams | null => {
  if (variant === 'team') {
    const seg = getHammerSegmentForHole(hole, segLen);
    const a = getHammerTeamAssignment(gameData, gameId, seg, segLen);
    if (!a) return null;
    return { teamA: a.teamA, teamB: a.teamB };
  }
  const data = gameData?.[gameId]?.[hole];
  if (!data?.lrTeamA || !data?.lrTeamB) return null;
  return { teamA: data.lrTeamA, teamB: data.lrTeamB, solo: data.lrSolo };
};

// Returns true if LR Hammer teams are set for the given hole (or N/A for Team Hammer).
export const hasLRHammerTeamsSet = (
  gameData: any,
  game: GameSettings,
  hole: number,
): boolean => {
  if (getHammerVariant(game) !== 'lr') return true;
  const data = gameData?.[game.id]?.[hole];
  return !!(data?.lrTeamA && data?.lrTeamB && data.lrTeamA.length > 0 && data.lrTeamB.length > 0);
};

// ---- Hammer pot math ----

export const getHammerHoleState = (
  gameData: any,
  gameId: string,
  hole: number,
): { hammerCount: number; lastThrownBy: 'A' | 'B' | null; concededBy: 'A' | 'B' | null } => {
  const data = gameData?.[gameId]?.[hole] || {};
  return {
    hammerCount: data.hammerCount ?? 0,
    lastThrownBy: data.lastThrownBy ?? null,
    concededBy: data.concededBy ?? null,
  };
};

export const calculateHammerPot = (basePot: number, hammerCount: number): number => {
  return basePot * Math.pow(2, hammerCount);
};

// ---- Strokes (uses game's universal handicap config) ----

const calcStrokes = (
  players: Player[],
  holeHandicapIndex: number,
  useHandicaps: boolean,
  handicapMode: 'absolute' | 'relative',
): { [pid: string]: number } => {
  const out: { [pid: string]: number } = {};
  if (!useHandicaps || players.length === 0) {
    players.forEach(p => out[p.id] = 0);
    return out;
  }
  if (handicapMode === 'relative') {
    const ref = players.reduce((min, p) => p.courseHandicap < min.courseHandicap ? p : min, players[0]);
    players.forEach(p => {
      if (p.id === ref.id) { out[p.id] = 0; return; }
      const diff = p.courseHandicap - ref.courseHandicap;
      out[p.id] = diff >= holeHandicapIndex ? 1 : 0;
    });
  } else {
    let allGet = 0;
    players.forEach(p => {
      const gets = holeHandicapIndex <= p.courseHandicap;
      out[p.id] = gets ? 1 : 0;
      if (gets) allGet++;
    });
    if (allGet === players.length) players.forEach(p => out[p.id] = 0);
  }
  return out;
};

// Compute hole result: which team won and which player(s) had the low ball.
// Returns null when scores incomplete.
export interface HammerHoleResult {
  winningTeam: 'A' | 'B' | null; // null = push
  lowBallPlayerIds: string[]; // winning team's low net ball owners (for birdie/eagle check)
  potBeforeMultipliers: number;
  potAfterMultipliers: number;
  basePot: number;
  hammerCount: number;
  // For 2v1 LR
  isSolo?: boolean;
  soloPlayerId?: string;
  pairPlayerIds?: string[];
}

export const calculateHammerHole = (
  round: Round,
  game: GameSettings,
  hole: number,
): HammerHoleResult | null => {
  const variant = getHammerVariant(game);
  const segLen = getHammerSegmentLength(game);
  const teams = getHammerHoleTeams(round.gameData, game.id, hole, variant, segLen);
  if (!teams) return null;

  const holeData = round.course.holes.find(h => h.number === hole);
  if (!holeData) return null;

  const { hammerCount, lastThrownBy, concededBy } = getHammerHoleState(round.gameData, game.id, hole);
  const basePot = game.unitStake;

  // Concession short-circuit: opponent wins base bet (no hammers, no multipliers).
  if (concededBy === 'A' || concededBy === 'B') {
    const winningTeam: 'A' | 'B' = concededBy === 'A' ? 'B' : 'A';
    const isSolo = variant === 'lr' && (teams.teamA.length === 1 || teams.teamB.length === 1);
    let soloPlayerId: string | undefined;
    let pairPlayerIds: string[] | undefined;
    if (isSolo) {
      if (teams.teamA.length === 1) { soloPlayerId = teams.teamA[0]; pairPlayerIds = teams.teamB; }
      else { soloPlayerId = teams.teamB[0]; pairPlayerIds = teams.teamA; }
    }
    return {
      winningTeam,
      lowBallPlayerIds: [],
      potBeforeMultipliers: basePot,
      potAfterMultipliers: basePot,
      basePot,
      hammerCount: 0,
      isSolo,
      soloPlayerId,
      pairPlayerIds,
    };
  }

  const scores = round.scores[hole];
  if (!scores) return null;

  const allIds = [...teams.teamA, ...teams.teamB];
  const players = round.players.filter(p => allIds.includes(p.id));
  if (players.length !== allIds.length) return null;

  // All required players must have valid scores
  const allScored = allIds.every(pid => typeof scores[pid] === 'number' && (scores[pid] as number) > 0);
  if (!allScored) return null;

  const useHandicaps = game.config.useHandicaps !== false;
  const handicapMode = (game.config.handicapMode ?? 'relative') as 'absolute' | 'relative';
  const strokes = calcStrokes(players, holeData.handicapIndex, useHandicaps, handicapMode);

  const netOf = (pid: string) => (scores[pid] as number) - (strokes[pid] || 0);

  const aNets = teams.teamA.map(pid => ({ pid, net: netOf(pid), gross: scores[pid] as number }));
  const bNets = teams.teamB.map(pid => ({ pid, net: netOf(pid), gross: scores[pid] as number }));

  const aLow = Math.min(...aNets.map(x => x.net));
  const bLow = Math.min(...bNets.map(x => x.net));

  const potBeforeMultipliers = calculateHammerPot(basePot, hammerCount);

  let winningTeam: 'A' | 'B' | null = null;
  if (aLow < bLow) winningTeam = 'A';
  else if (bLow < aLow) winningTeam = 'B';

  // 2nd Ball Tiebreaker: if 1st balls tie and option enabled, compare 2nd lowest nets.
  // Only applies to 2v2 (each team needs ≥2 players); skip in 2v1 LR holes.
  if (
    !winningTeam &&
    game.config.hammer?.useSecondBallTiebreaker === true &&
    teams.teamA.length >= 2 &&
    teams.teamB.length >= 2
  ) {
    const aSorted = aNets.map(x => x.net).sort((a, b) => a - b);
    const bSorted = bNets.map(x => x.net).sort((a, b) => a - b);
    const aSecond = aSorted[1];
    const bSecond = bSorted[1];
    if (aSecond < bSecond) winningTeam = 'A';
    else if (bSecond < aSecond) winningTeam = 'B';
  }

  if (!winningTeam) {
    return {
      winningTeam: null,
      lowBallPlayerIds: [],
      potBeforeMultipliers,
      potAfterMultipliers: 0,
      basePot,
      hammerCount,
    };
  }

  // Birdie/eagle multiplier on winning team's low ball (gross-only trigger, same as Banker)
  const winningSide = winningTeam === 'A' ? aNets : bNets;
  const winningLowNet = winningTeam === 'A' ? aLow : bLow;
  const winnersWithLow = winningSide.filter(x => x.net === winningLowNet);
  const winningLowGross = Math.min(...winnersWithLow.map(x => x.gross));
  const lowBallPlayerIds = winnersWithLow.filter(x => x.gross === winningLowGross).map(x => x.pid);

  const birdieMult = game.config.birdieMultiplier ?? 1;
  const eagleMult = game.config.eagleMultiplier ?? 1;
  const toPar = winningLowGross - holeData.par;
  let mult = 1;
  if (eagleMult > 1 && toPar <= -2) mult = eagleMult;
  else if (birdieMult > 1 && toPar === -1) mult = birdieMult;

  const potAfterMultipliers = potBeforeMultipliers * mult;

  // 2v1 detection (LR mode, 3 players: solo on teamB)
  const isSolo = variant === 'lr' && (teams.teamA.length === 1 || teams.teamB.length === 1);
  let soloPlayerId: string | undefined;
  let pairPlayerIds: string[] | undefined;
  if (isSolo) {
    if (teams.teamA.length === 1) { soloPlayerId = teams.teamA[0]; pairPlayerIds = teams.teamB; }
    else { soloPlayerId = teams.teamB[0]; pairPlayerIds = teams.teamA; }
  }

  return {
    winningTeam,
    lowBallPlayerIds,
    potBeforeMultipliers,
    potAfterMultipliers,
    basePot,
    hammerCount,
    isSolo,
    soloPlayerId,
    pairPlayerIds,
  };
};

// Per-hole P&L distribution. 2v2: each loser pays pot, each winner gets pot.
// 2v1: solo wins → pair each pays pot, solo +2*pot. pair wins → solo pays each pair member pot, solo -2*pot.
export const calculateHammerHolePayouts = (
  round: Round,
  game: GameSettings,
  hole: number,
): { [playerId: string]: number } | null => {
  const result = calculateHammerHole(round, game, hole);
  if (!result || !result.winningTeam) return null;

  const variant = getHammerVariant(game);
  const segLen = getHammerSegmentLength(game);
  const teams = getHammerHoleTeams(round.gameData, game.id, hole, variant, segLen);
  if (!teams) return null;

  const payouts: { [pid: string]: number } = {};
  [...teams.teamA, ...teams.teamB].forEach(pid => payouts[pid] = 0);
  const pot = result.potAfterMultipliers;

  if (result.isSolo && result.soloPlayerId && result.pairPlayerIds) {
    const solo = result.soloPlayerId;
    const pair = result.pairPlayerIds;
    const soloIsTeamA = teams.teamA.includes(solo);
    const soloWon = (result.winningTeam === 'A' && soloIsTeamA) || (result.winningTeam === 'B' && !soloIsTeamA);
    if (soloWon) {
      payouts[solo] = pot * pair.length; // each pair member pays pot
      pair.forEach(pid => payouts[pid] = -pot);
    } else {
      payouts[solo] = -pot * pair.length;
      pair.forEach(pid => payouts[pid] = pot);
    }
  } else {
    // 2v2
    const winners = result.winningTeam === 'A' ? teams.teamA : teams.teamB;
    const losers = result.winningTeam === 'A' ? teams.teamB : teams.teamA;
    winners.forEach(pid => payouts[pid] = pot);
    losers.forEach(pid => payouts[pid] = -pot);
  }
  return payouts;
};

// Main aggregator
export const calculateHammer = (round: Round, game: GameSettings): GameResult => {
  const results: { [pid: string]: number } = {};
  const holeResults: { [hole: number]: { [pid: string]: number } } = {};
  const details: string[] = [];
  round.players.forEach(p => results[p.id] = 0);

  for (const hole of round.course.holes) {
    const h = hole.number;
    const payouts = calculateHammerHolePayouts(round, game, h);
    if (!payouts) {
      // Could be incomplete OR push
      const result = calculateHammerHole(round, game, h);
      if (result && result.winningTeam === null) {
        details.push(`Hole ${h}: Push (pot $${result.potBeforeMultipliers} resets)`);
      }
      continue;
    }
    holeResults[h] = { ...payouts };
    Object.entries(payouts).forEach(([pid, amt]) => results[pid] = (results[pid] || 0) + amt);

    const result = calculateHammerHole(round, game, h)!;
    const winnerNames = (result.winningTeam === 'A'
      ? (getHammerHoleTeams(round.gameData, game.id, h, getHammerVariant(game), getHammerSegmentLength(game))?.teamA || [])
      : (getHammerHoleTeams(round.gameData, game.id, h, getHammerVariant(game), getHammerSegmentLength(game))?.teamB || []))
      .map(pid => round.players.find(p => p.id === pid)?.name || '?').join(' & ');
    const { concededBy } = getHammerHoleState(round.gameData, game.id, h);
    if (concededBy) {
      details.push(`Hole ${h}: Team ${concededBy} conceded — ${winnerNames} win $${result.potAfterMultipliers}`);
    } else {
      const multNote = result.potAfterMultipliers !== result.potBeforeMultipliers
        ? ` (×${result.potAfterMultipliers / result.potBeforeMultipliers} bonus)` : '';
      const hammerNote = result.hammerCount > 0 ? ` [${result.hammerCount} hammer]` : '';
      details.push(`Hole ${h}: ${winnerNames} win $${result.potAfterMultipliers}${hammerNote}${multNote}`);
    }
  }

  return { gameId: game.id, playerResults: results, details, holeResults };
};
