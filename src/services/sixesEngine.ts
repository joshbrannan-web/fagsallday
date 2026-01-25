import { Round, GameSettings, GameResult, SixesTeamAssignment, SixesPressState, Player } from "../types";
import { getNetScore } from "./gameEngine";

// Type for stretch numbers
export type SixesStretch = 1 | 2 | 3 | 4 | 5 | 6;
export type SixesMode = 'sixes' | 'threes';

// Stretch definitions for 6's mode (6 holes each)
export const SIXES_STRETCH_HOLES: { [key: number]: number[] } = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18],
};

// Stretch definitions for 3's mode (3 holes each)
export const THREES_STRETCH_HOLES: { [key: number]: number[] } = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
  5: [13, 14, 15],
  6: [16, 17, 18],
};

// Get stretch holes based on mode
export const getStretchHolesForMode = (stretch: SixesStretch, mode: SixesMode = 'sixes'): number[] => {
  if (mode === 'threes') {
    return THREES_STRETCH_HOLES[stretch] || [];
  }
  return SIXES_STRETCH_HOLES[stretch] || [];
};

// Get stretch number for a hole (1-18)
export const getSixesStretchForHole = (hole: number, mode: SixesMode = 'sixes'): SixesStretch => {
  if (mode === 'threes') {
    if (hole <= 3) return 1;
    if (hole <= 6) return 2;
    if (hole <= 9) return 3;
    if (hole <= 12) return 4;
    if (hole <= 15) return 5;
    return 6;
  }
  // 6's mode (original)
  if (hole <= 6) return 1;
  if (hole <= 12) return 2;
  return 3;
};

// Is this a stretch start hole?
export const isSixesStretchStartHole = (hole: number, mode: SixesMode = 'sixes'): boolean => {
  if (mode === 'threes') {
    return [1, 4, 7, 10, 13, 16].includes(hole);
  }
  return hole === 1 || hole === 7 || hole === 13;
};

// Is this a stretch end hole?
export const isSixesStretchEndHole = (hole: number, mode: SixesMode = 'sixes'): boolean => {
  if (mode === 'threes') {
    return [3, 6, 9, 12, 15, 18].includes(hole);
  }
  return hole === 6 || hole === 12 || hole === 18;
};

// Get the start hole for a stretch
export const getStretchStartHole = (stretch: SixesStretch, mode: SixesMode = 'sixes'): number => {
  if (mode === 'threes') {
    const starts = [1, 4, 7, 10, 13, 16];
    return starts[stretch - 1] || 1;
  }
  return (stretch - 1) * 6 + 1;
};

// Get the end hole for a stretch
export const getStretchEndHole = (stretch: SixesStretch, mode: SixesMode = 'sixes'): number => {
  if (mode === 'threes') {
    const ends = [3, 6, 9, 12, 15, 18];
    return ends[stretch - 1] || 3;
  }
  return stretch * 6;
};

// Get holes per stretch
export const getHolesPerStretch = (mode: SixesMode = 'sixes'): number => {
  return mode === 'threes' ? 3 : 6;
};

// Get total number of stretches
export const getTotalStretches = (mode: SixesMode = 'sixes'): number => {
  return mode === 'threes' ? 6 : 3;
};

// Get all stretch numbers for a mode
export const getAllStretches = (mode: SixesMode = 'sixes'): SixesStretch[] => {
  return mode === 'threes' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
};

// Get team assignment from gameData
export const getSixesTeamAssignment = (
  gameData: any,
  gameId: string,
  stretch: SixesStretch,
  mode: SixesMode = 'sixes'
): SixesTeamAssignment | null => {
  const stretchStartHole = getStretchStartHole(stretch, mode);
  const data = gameData?.[gameId]?.[stretchStartHole];
  
  if (!data?._META_TEAM_A || !data?._META_TEAM_B) return null;
  
  return {
    teamA: data._META_TEAM_A,
    teamB: data._META_TEAM_B,
    unitValue: data._META_UNIT_VALUE ?? 10,
    useHandicaps: data._META_USE_HANDICAPS ?? true,
    useSecondBallTiebreaker: data._META_USE_SECOND_BALL ?? false,
    handicapMode: data._META_HANDICAP_MODE ?? 'absolute',
    allowPresses: data._META_ALLOW_PRESSES ?? false,
    mode: data._META_MODE ?? mode,
    locked: data._META_LOCKED ?? false,
  };
};

// Get the mode from gameData (stored at stretch 1)
export const getSixesMode = (gameData: any, gameId: string): SixesMode => {
  // Mode is stored in Stretch 1 metadata at hole 1
  const data = gameData?.[gameId]?.[1];
  return data?._META_MODE ?? 'sixes';
};

// Get presses for a stretch
export const getSixesPresses = (
  gameData: any,
  gameId: string,
  stretch: SixesStretch,
  mode: SixesMode = 'sixes'
): SixesPressState[] => {
  const stretchStartHole = getStretchStartHole(stretch, mode);
  return gameData?.[gameId]?.[stretchStartHole]?._META_PRESSES || [];
};

// Check if a team is past dormie (cannot mathematically catch opponent)
export const isSixesTeamDormie = (
  teamWins: number,
  opponentWins: number,
  holesRemaining: number
): boolean => {
  // Team is past dormie if even winning all remaining holes wouldn't catch opponent
  return teamWins + holesRemaining < opponentWins;
};

// Get dormie status for current stretch
export const getSixesDormieStatus = (
  round: Round,
  game: GameSettings,
  activeHole: number,
  mode: SixesMode = 'sixes'
): { 
  teamADormie: boolean; 
  teamBDormie: boolean; 
  holesRemaining: number;
  teamAWins: number;
  teamBWins: number;
  stretch: SixesStretch;
} | null => {
  const stretch = getSixesStretchForHole(activeHole, mode);
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch, mode);
  
  if (!teamAssignment) return null;
  
  const stretchResult = calculateSixesStretchResult(round, game, stretch, mode);
  if (!stretchResult) return null;
  
  const holesPerStretch = getHolesPerStretch(mode);
  const holesPlayed = stretchResult.teamAWins + stretchResult.teamBWins + stretchResult.ties;
  const holesRemaining = holesPerStretch - holesPlayed;
  
  return {
    teamADormie: isSixesTeamDormie(stretchResult.teamAWins, stretchResult.teamBWins, holesRemaining),
    teamBDormie: isSixesTeamDormie(stretchResult.teamBWins, stretchResult.teamAWins, holesRemaining),
    holesRemaining,
    teamAWins: stretchResult.teamAWins,
    teamBWins: stretchResult.teamBWins,
    stretch
  };
};

// Check if there's already an active press for a team in the current stretch starting at or after the current hole
export const hasExistingSixesPress = (
  gameData: any,
  gameId: string,
  stretch: SixesStretch,
  teamDormie: 'A' | 'B',
  currentHole: number,
  mode: SixesMode = 'sixes'
): boolean => {
  const presses = getSixesPresses(gameData, gameId, stretch, mode);
  return presses.some(p => p.teamDormie === teamDormie && p.startHole <= currentHole);
};

// Calculate strokes for all players on a given hole
// Supports both 'absolute' mode (Stockton 6 style) and 'relative' mode (lowest HCP = 0)
export const calculateSixesStrokes = (
  players: Player[],
  holeHandicapIndex: number,
  handicapMode: 'absolute' | 'relative' = 'absolute'
): { [playerId: string]: number } => {
  const strokes: { [playerId: string]: number } = {};
  
  if (handicapMode === 'relative') {
    // Relative mode: Find lowest handicap player as reference (gets 0 strokes)
    const refPlayer = players.reduce(
      (min, p) => (p.courseHandicap < min.courseHandicap ? p : min),
      players[0]
    );
    
    players.forEach(player => {
      if (player.id === refPlayer.id) {
        strokes[player.id] = 0;
        return;
      }
      const diff = player.courseHandicap - refPlayer.courseHandicap;
      strokes[player.id] = diff >= holeHandicapIndex ? 1 : 0;
    });
  } else {
    // Absolute mode: Player gets a stroke if hole index <= their handicap
    // If ALL players would receive a stroke, cancel them all out
    let playersReceivingStrokes = 0;
    
    players.forEach(player => {
      const getsStroke = holeHandicapIndex <= player.courseHandicap;
      strokes[player.id] = getsStroke ? 1 : 0;
      if (getsStroke) playersReceivingStrokes++;
    });
    
    // If ALL players would get a stroke, cancel them all out
    if (playersReceivingStrokes === players.length) {
      players.forEach(player => {
        strokes[player.id] = 0;
      });
    }
  }
  
  return strokes;
};

// Determine hole winner: 'A', 'B', or 'TIE'
export const calculateSixesHoleResult = (
  round: Round,
  hole: number,
  teamA: string[],
  teamB: string[],
  useHandicaps: boolean,
  useSecondBallTiebreaker: boolean,
  handicapMode: 'absolute' | 'relative' = 'absolute'
): 'A' | 'B' | 'TIE' | null => {
  const holeData = round.course.holes.find(h => h.number === hole);
  const holeScores = round.scores[hole];
  
  if (!holeData || !holeScores) return null;
  
  // Get all 4 players
  const allPlayerIds = [...teamA, ...teamB];
  const allPlayers = round.players.filter(p => allPlayerIds.includes(p.id));
  
  // Check if all players have scores
  const allHaveScores = allPlayerIds.every(pid => typeof holeScores[pid] === 'number');
  if (!allHaveScores) return null;
  
  // Calculate strokes if using handicaps
  const strokes = useHandicaps 
    ? calculateSixesStrokes(allPlayers, holeData.handicapIndex, handicapMode)
    : allPlayerIds.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {} as { [playerId: string]: number });
  
  // Calculate net scores
  const getPlayerNet = (playerId: string): number => {
    const gross = holeScores[playerId]!;
    const playerStrokes = strokes[playerId] || 0;
    return gross - playerStrokes;
  };
  
  const teamANets = teamA.map(getPlayerNet);
  const teamBNets = teamB.map(getPlayerNet);
  
  // 1st Ball: Compare lowest scores
  const teamA1stBall = Math.min(...teamANets);
  const teamB1stBall = Math.min(...teamBNets);
  
  if (teamA1stBall < teamB1stBall) return 'A';
  if (teamB1stBall < teamA1stBall) return 'B';
  
  // Tie on 1st ball - check if 2nd ball tiebreaker is enabled
  if (useSecondBallTiebreaker) {
    const teamA2ndBall = Math.max(...teamANets);
    const teamB2ndBall = Math.max(...teamBNets);
    
    if (teamA2ndBall < teamB2ndBall) return 'A';
    if (teamB2ndBall < teamA2ndBall) return 'B';
  }
  
  return 'TIE';
};

// Calculate stretch result: holes won by each team
export const calculateSixesStretchResult = (
  round: Round,
  game: GameSettings,
  stretch: SixesStretch,
  mode: SixesMode = 'sixes'
): { teamAWins: number; teamBWins: number; ties: number; complete: boolean } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch, mode);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode } = teamAssignment;
  const stretchHoles = getStretchHolesForMode(stretch, mode);
  const holesPerStretch = getHolesPerStretch(mode);
  
  let teamAWins = 0;
  let teamBWins = 0;
  let ties = 0;
  let holesPlayed = 0;
  
  for (const hole of stretchHoles) {
    const result = calculateSixesHoleResult(round, hole, teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode);
    if (result === null) continue;
    
    holesPlayed++;
    if (result === 'A') teamAWins++;
    else if (result === 'B') teamBWins++;
    else ties++;
  }
  
  return {
    teamAWins,
    teamBWins,
    ties,
    complete: holesPlayed === holesPerStretch
  };
};

// Get stretch name for display
export const getStretchName = (stretch: SixesStretch, mode: SixesMode = 'sixes'): string => {
  const holes = getStretchHolesForMode(stretch, mode);
  if (holes.length === 0) return '';
  return `Holes ${holes[0]}-${holes[holes.length - 1]}`;
};

// Calculate stretch payouts
export const calculateSixesStretchPayouts = (
  round: Round,
  game: GameSettings,
  stretch: SixesStretch,
  mode: SixesMode = 'sixes'
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch, mode);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue } = teamAssignment;
  const stretchResult = calculateSixesStretchResult(round, game, stretch, mode);
  
  if (!stretchResult || !stretchResult.complete) return null;
  
  const { teamAWins, teamBWins } = stretchResult;
  const details: string[] = [];
  const playerPayouts: { [playerId: string]: number } = {};
  
  // Initialize all payouts to 0
  [...teamA, ...teamB].forEach(pid => playerPayouts[pid] = 0);
  
  const stretchName = getStretchName(stretch, mode);
  
  if (teamAWins > teamBWins) {
    // Team A wins: each winner wins unitValue, each loser loses unitValue
    teamA.forEach(pid => playerPayouts[pid] = unitValue);
    teamB.forEach(pid => playerPayouts[pid] = -unitValue);
    
    const teamANames = teamA.map(pid => round.players.find(p => p.id === pid)?.name || 'Unknown').join(' & ');
    details.push(`${stretchName}: Team A (${teamANames}) wins ${teamAWins}-${teamBWins} (+$${unitValue} each)`);
  } else if (teamBWins > teamAWins) {
    // Team B wins: each winner wins unitValue, each loser loses unitValue
    teamB.forEach(pid => playerPayouts[pid] = unitValue);
    teamA.forEach(pid => playerPayouts[pid] = -unitValue);
    
    const teamBNames = teamB.map(pid => round.players.find(p => p.id === pid)?.name || 'Unknown').join(' & ');
    details.push(`${stretchName}: Team B (${teamBNames}) wins ${teamBWins}-${teamAWins} (+$${unitValue} each)`);
  } else {
    // Push - no money changes hands
    details.push(`${stretchName}: Push ${teamAWins}-${teamBWins} (tie)`);
  }
  
  return { playerPayouts, details };
};

// Calculate press payouts for a stretch
export const calculateSixesPressPayouts = (
  round: Round,
  game: GameSettings,
  stretch: SixesStretch,
  mode: SixesMode = 'sixes'
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch, mode);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode } = teamAssignment;
  const presses = getSixesPresses(round.gameData, game.id, stretch, mode);
  
  if (presses.length === 0) return null;
  
  const stretchEndHole = getStretchEndHole(stretch, mode);
  const details: string[] = [];
  const playerPayouts: { [playerId: string]: number } = {};
  
  // Initialize all payouts to 0
  [...teamA, ...teamB].forEach(pid => playerPayouts[pid] = 0);
  
  for (const press of presses) {
    // Count holes won from press.startHole to stretch end
    let teamAWinsInPress = 0;
    let teamBWinsInPress = 0;
    let holesInPressCompleted = 0;
    
    for (let h = press.startHole; h <= stretchEndHole; h++) {
      const holeResult = calculateSixesHoleResult(round, h, teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode);
      if (holeResult === null) continue;
      holesInPressCompleted++;
      if (holeResult === 'A') teamAWinsInPress++;
      else if (holeResult === 'B') teamBWinsInPress++;
    }
    
    // Check if all holes in press range are complete
    const totalPressHoles = stretchEndHole - press.startHole + 1;
    if (holesInPressCompleted < totalPressHoles) continue;
    
    const stretchName = getStretchName(stretch, mode);
    
    // Determine press winner
    if (teamAWinsInPress > teamBWinsInPress) {
      // Team A wins press
      teamA.forEach(pid => playerPayouts[pid] += press.unitValue);
      teamB.forEach(pid => playerPayouts[pid] -= press.unitValue);
      details.push(`${stretchName} Press (Hole ${press.startHole}): Team A wins ${teamAWinsInPress}-${teamBWinsInPress} (+$${press.unitValue}/player)`);
    } else if (teamBWinsInPress > teamAWinsInPress) {
      // Team B wins press
      teamB.forEach(pid => playerPayouts[pid] += press.unitValue);
      teamA.forEach(pid => playerPayouts[pid] -= press.unitValue);
      details.push(`${stretchName} Press (Hole ${press.startHole}): Team B wins ${teamBWinsInPress}-${teamAWinsInPress} (+$${press.unitValue}/player)`);
    } else {
      details.push(`${stretchName} Press (Hole ${press.startHole}): Push ${teamAWinsInPress}-${teamBWinsInPress}`);
    }
  }
  
  return { playerPayouts, details };
};

// Main calculation function
export const calculateSixes = (round: Round, game: GameSettings): GameResult => {
  const results: { [playerId: string]: number } = {};
  const details: string[] = [];
  const holeResults: { [holeNumber: number]: { [playerId: string]: number } } = {};
  
  // Initialize results for all players
  round.players.forEach(p => results[p.id] = 0);
  
  // Get mode from gameData
  const mode = getSixesMode(round.gameData, game.id);
  const stretches = getAllStretches(mode);
  
  // Calculate payouts for each stretch
  for (const stretch of stretches) {
    const stretchPayouts = calculateSixesStretchPayouts(round, game, stretch, mode);
    
    if (stretchPayouts) {
      // Add to overall results
      Object.entries(stretchPayouts.playerPayouts).forEach(([playerId, amount]) => {
        results[playerId] = (results[playerId] || 0) + amount;
      });
      
      // Add details
      details.push(...stretchPayouts.details);
      
      // Record at stretch end hole for per-hole breakdown
      const stretchEndHole = getStretchEndHole(stretch, mode);
      holeResults[stretchEndHole] = { ...stretchPayouts.playerPayouts };
    }
    
    // Calculate press payouts for this stretch
    const pressPayouts = calculateSixesPressPayouts(round, game, stretch, mode);
    
    if (pressPayouts) {
      // Add to overall results
      Object.entries(pressPayouts.playerPayouts).forEach(([playerId, amount]) => {
        results[playerId] = (results[playerId] || 0) + amount;
      });
      
      // Add details
      details.push(...pressPayouts.details);
    }
  }
  
  return {
    gameId: game.id,
    playerResults: results,
    details,
    holeResults
  };
};

// Validate that totals sum to zero
export const validateSixesTotals = (results: { [playerId: string]: number }): boolean => {
  const total = Object.values(results).reduce((sum, val) => sum + val, 0);
  return Math.abs(total) < 0.01;
};
