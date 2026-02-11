import { Round, GameSettings, GameResult, Player } from "../types";
import { calculateSixesStrokes } from "./sixesEngine";

// Types
export type TeamBankerMode = 'eighteen' | 'sixes' | 'threes';
export type TeamBankerStretch = 1 | 2 | 3 | 4 | 5 | 6;

// Team assignment metadata interface
export interface TeamBankerTeamAssignment {
  teamA: string[];
  teamB: string[];
  unitValue: number;
  useHandicaps: boolean;
  handicapMode: 'absolute' | 'relative';
  useSecondBallTiebreaker: boolean;
  mode: TeamBankerMode;
  birdieMultiplier: number;
  eagleMultiplier: number;
  locked: boolean;
}

// Stretch hole definitions
const EIGHTEEN_STRETCH_HOLES: { [key: number]: number[] } = {
  1: Array.from({ length: 18 }, (_, i) => i + 1),
};

const SIXES_STRETCH_HOLES: { [key: number]: number[] } = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18],
};

const THREES_STRETCH_HOLES: { [key: number]: number[] } = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
  5: [13, 14, 15],
  6: [16, 17, 18],
};

export const getTeamBankerStretchForHole = (hole: number, mode: TeamBankerMode): TeamBankerStretch => {
  if (mode === 'eighteen') return 1;
  if (mode === 'threes') {
    if (hole <= 3) return 1;
    if (hole <= 6) return 2;
    if (hole <= 9) return 3;
    if (hole <= 12) return 4;
    if (hole <= 15) return 5;
    return 6;
  }
  // sixes
  if (hole <= 6) return 1;
  if (hole <= 12) return 2;
  return 3;
};

export const isTeamBankerStretchStartHole = (hole: number, mode: TeamBankerMode): boolean => {
  if (mode === 'eighteen') return hole === 1;
  if (mode === 'threes') return [1, 4, 7, 10, 13, 16].includes(hole);
  return [1, 7, 13].includes(hole);
};

export const getTeamBankerStretchStartHole = (stretch: TeamBankerStretch, mode: TeamBankerMode): number => {
  if (mode === 'eighteen') return 1;
  if (mode === 'threes') {
    return [1, 4, 7, 10, 13, 16][stretch - 1] || 1;
  }
  return (stretch - 1) * 6 + 1;
};

export const getTeamBankerTotalStretches = (mode: TeamBankerMode): number => {
  if (mode === 'eighteen') return 1;
  if (mode === 'threes') return 6;
  return 3;
};

export const getTeamBankerAllStretches = (mode: TeamBankerMode): TeamBankerStretch[] => {
  if (mode === 'eighteen') return [1];
  if (mode === 'threes') return [1, 2, 3, 4, 5, 6];
  return [1, 2, 3];
};

export const getTeamBankerMode = (gameData: any, gameId: string): TeamBankerMode => {
  const data = gameData?.[gameId]?.[1];
  return data?._META_MODE ?? 'sixes';
};

export const getTeamBankerTeamAssignment = (
  gameData: any,
  gameId: string,
  stretch: TeamBankerStretch,
  mode: TeamBankerMode
): TeamBankerTeamAssignment | null => {
  const stretchStartHole = getTeamBankerStretchStartHole(stretch, mode);
  const data = gameData?.[gameId]?.[stretchStartHole];

  if (!data?._META_TEAM_A || !data?._META_TEAM_B) return null;

  return {
    teamA: data._META_TEAM_A,
    teamB: data._META_TEAM_B,
    unitValue: data._META_UNIT_VALUE ?? 3,
    useHandicaps: data._META_USE_HANDICAPS ?? true,
    handicapMode: data._META_HANDICAP_MODE ?? 'relative',
    useSecondBallTiebreaker: data._META_USE_SECOND_BALL ?? false,
    mode: data._META_MODE ?? mode,
    birdieMultiplier: data._META_BIRDIE_MULT ?? 3,
    eagleMultiplier: data._META_EAGLE_MULT ?? 5,
    locked: data._META_LOCKED ?? false,
  };
};

// Calculate Team Banker for an entire round
export const calculateTeamBanker = (round: Round, game: GameSettings): GameResult => {
  const results: { [playerId: string]: number } = {};
  const details: string[] = [];
  const holeResults: { [holeNumber: number]: { [playerId: string]: number } } = {};

  round.players.forEach(p => results[p.id] = 0);

  const mode = getTeamBankerMode(round.gameData, game.id);
  const stretches = getTeamBankerAllStretches(mode);

  for (const stretch of stretches) {
    const assignment = getTeamBankerTeamAssignment(round.gameData, game.id, stretch, mode);
    if (!assignment) continue;

    const { teamA, teamB, unitValue, useHandicaps, handicapMode, useSecondBallTiebreaker, birdieMultiplier, eagleMultiplier } = assignment;
    const allPlayerIds = [...teamA, ...teamB];
    const allPlayers = round.players.filter(p => allPlayerIds.includes(p.id));

    // Determine holes for this stretch
    const stretchStartHole = getTeamBankerStretchStartHole(stretch, mode);
    let stretchHoles: number[];
    if (mode === 'eighteen') stretchHoles = EIGHTEEN_STRETCH_HOLES[1];
    else if (mode === 'threes') stretchHoles = THREES_STRETCH_HOLES[stretch] || [];
    else stretchHoles = SIXES_STRETCH_HOLES[stretch] || [];

    for (const holeNumber of stretchHoles) {
      const hole = round.course.holes.find(h => h.number === holeNumber);
      const holeScores = round.scores[holeNumber];
      if (!hole || !holeScores) continue;

      // Check all 4 players have scores
      const allHaveScores = allPlayerIds.every(pid => typeof holeScores[pid] === 'number');
      if (!allHaveScores) continue;

      holeResults[holeNumber] = {};
      allPlayerIds.forEach(pid => holeResults[holeNumber][pid] = 0);

      // Read multipliers for each player
      const holeMultData = round.gameData?.[game.id]?.[holeNumber] || {};
      const playerMultipliers: { [pid: string]: number } = {};
      allPlayerIds.forEach(pid => {
        const mult = holeMultData[pid];
        playerMultipliers[pid] = (typeof mult === 'number' && mult >= 1) ? mult : 1;
      });

      // Compound all multipliers
      const compoundMultiplier = allPlayerIds.reduce((acc, pid) => acc * playerMultipliers[pid], 1);

      // Calculate net scores
      const strokes = useHandicaps
        ? calculateSixesStrokes(allPlayers, hole.handicapIndex, handicapMode)
        : allPlayerIds.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {} as { [pid: string]: number });

      const getNet = (pid: string) => holeScores[pid]! - (strokes[pid] || 0);

      const teamANets = teamA.map(getNet);
      const teamBNets = teamB.map(getNet);

      // 1st ball comparison (lowest net)
      const teamA1st = Math.min(...teamANets);
      const teamB1st = Math.min(...teamBNets);

      let winner: 'A' | 'B' | null = null;

      if (teamA1st < teamB1st) {
        winner = 'A';
      } else if (teamB1st < teamA1st) {
        winner = 'B';
      } else if (useSecondBallTiebreaker) {
        // 2nd ball comparison (higher net)
        const teamA2nd = Math.max(...teamANets);
        const teamB2nd = Math.max(...teamBNets);
        if (teamA2nd < teamB2nd) winner = 'A';
        else if (teamB2nd < teamA2nd) winner = 'B';
      }

      if (winner === null) {
        // Push
        continue;
      }

      // Apply birdie/eagle multiplier based on winning team's best gross score
      const winningTeam = winner === 'A' ? teamA : teamB;
      const bestGross = Math.min(...winningTeam.map(pid => holeScores[pid]!));
      const bestToPar = bestGross - hole.par;

      let scoreMultiplier = 1;
      if (eagleMultiplier > 1 && bestToPar <= -2) {
        scoreMultiplier = eagleMultiplier;
      } else if (birdieMultiplier > 1 && bestToPar === -1) {
        scoreMultiplier = birdieMultiplier;
      }

      const payout = unitValue * compoundMultiplier * scoreMultiplier;

      const winTeam = winner === 'A' ? teamA : teamB;
      const loseTeam = winner === 'A' ? teamB : teamA;

      winTeam.forEach(pid => {
        results[pid] += payout;
        holeResults[holeNumber][pid] = payout;
      });
      loseTeam.forEach(pid => {
        results[pid] -= payout;
        holeResults[holeNumber][pid] = -payout;
      });
    }
  }

  return {
    gameId: game.id,
    playerResults: results,
    details,
    holeResults,
  };
};
