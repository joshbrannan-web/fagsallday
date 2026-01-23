import { Round, GameSettings, GameResult, SixesTeamAssignment, SixesPressState, Player } from "../types";
import { getNetScore } from "./gameEngine";

// Stretch definitions (6 holes each) - same as Stockton 6's
export const SIXES_STRETCH_HOLES = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18],
};

// Get stretch number for a hole (1-18)
export const getSixesStretchForHole = (hole: number): 1 | 2 | 3 => {
  if (hole <= 6) return 1;
  if (hole <= 12) return 2;
  return 3;
};

// Is this a stretch start hole?
export const isSixesStretchStartHole = (hole: number): boolean => {
  return hole === 1 || hole === 7 || hole === 13;
};

// Is this a stretch end hole?
export const isSixesStretchEndHole = (hole: number): boolean => {
  return hole === 6 || hole === 12 || hole === 18;
};

// Get team assignment from gameData
export const getSixesTeamAssignment = (
  gameData: any,
  gameId: string,
  stretch: 1 | 2 | 3
): SixesTeamAssignment | null => {
  const stretchStartHole = (stretch - 1) * 6 + 1;
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
    locked: data._META_LOCKED ?? false,
  };
};

// Get presses for a stretch
export const getSixesPresses = (
  gameData: any,
  gameId: string,
  stretch: 1 | 2 | 3
): SixesPressState[] => {
  const stretchStartHole = (stretch - 1) * 6 + 1;
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
  activeHole: number
): { 
  teamADormie: boolean; 
  teamBDormie: boolean; 
  holesRemaining: number;
  teamAWins: number;
  teamBWins: number;
  stretch: 1 | 2 | 3;
} | null => {
  const stretch = getSixesStretchForHole(activeHole);
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  
  if (!teamAssignment) return null;
  
  const stretchResult = calculateSixesStretchResult(round, game, stretch);
  if (!stretchResult) return null;
  
  const holesPlayed = stretchResult.teamAWins + stretchResult.teamBWins + stretchResult.ties;
  const holesRemaining = 6 - holesPlayed;
  
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
  stretch: 1 | 2 | 3,
  teamDormie: 'A' | 'B',
  currentHole: number
): boolean => {
  const presses = getSixesPresses(gameData, gameId, stretch);
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
  stretch: 1 | 2 | 3
): { teamAWins: number; teamBWins: number; ties: number; complete: boolean } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode } = teamAssignment;
  const stretchHoles = SIXES_STRETCH_HOLES[stretch];
  
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
    complete: holesPlayed === 6
  };
};

// Calculate stretch payouts
export const calculateSixesStretchPayouts = (
  round: Round,
  game: GameSettings,
  stretch: 1 | 2 | 3
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue } = teamAssignment;
  const stretchResult = calculateSixesStretchResult(round, game, stretch);
  
  if (!stretchResult || !stretchResult.complete) return null;
  
  const { teamAWins, teamBWins } = stretchResult;
  const details: string[] = [];
  const playerPayouts: { [playerId: string]: number } = {};
  
  // Initialize all payouts to 0
  [...teamA, ...teamB].forEach(pid => playerPayouts[pid] = 0);
  
  const stretchName = stretch === 1 ? 'Holes 1-6' : stretch === 2 ? 'Holes 7-12' : 'Holes 13-18';
  
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
  stretch: 1 | 2 | 3
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, useHandicaps, useSecondBallTiebreaker, handicapMode } = teamAssignment;
  const presses = getSixesPresses(round.gameData, game.id, stretch);
  
  if (presses.length === 0) return null;
  
  const stretchEndHole = stretch * 6;
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
    
    const stretchName = stretch === 1 ? 'Holes 1-6' : stretch === 2 ? 'Holes 7-12' : 'Holes 13-18';
    
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
  
  // Calculate payouts for each stretch
  for (const stretch of [1, 2, 3] as const) {
    const stretchPayouts = calculateSixesStretchPayouts(round, game, stretch);
    
    if (stretchPayouts) {
      // Add to overall results
      Object.entries(stretchPayouts.playerPayouts).forEach(([playerId, amount]) => {
        results[playerId] = (results[playerId] || 0) + amount;
      });
      
      // Add details
      details.push(...stretchPayouts.details);
      
      // Record at stretch end hole for per-hole breakdown
      const stretchEndHole = stretch * 6;
      holeResults[stretchEndHole] = { ...stretchPayouts.playerPayouts };
    }
    
    // Calculate press payouts for this stretch
    const pressPayouts = calculateSixesPressPayouts(round, game, stretch);
    
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
