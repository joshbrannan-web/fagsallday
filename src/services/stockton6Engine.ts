import { Round, GameSettings, GameResult, DotType, Stockton6TeamAssignment, Stockton6BallState, Stockton6PressState, Player } from "../types";
import { getNetScore, calculateStrokesReceived } from "./gameEngine";

// Calculate strokes for all players on a given hole
// Player gets a stroke if hole index <= their handicap
// If ALL players would receive a stroke, cancel them all out
export const calculateRelativeStrokes = (
  players: Player[],
  holeHandicapIndex: number
): { [playerId: string]: number } => {
  // Calculate stroke eligibility for each player
  const strokes: { [playerId: string]: number } = {};
  let playersReceivingStrokes = 0;
  
  players.forEach(player => {
    // Player gets a stroke if hole index <= their handicap
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
  
  return strokes;
};

// Stretch definitions (6 holes each)
export const STRETCH_HOLES = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18],
};

// Get stretch number for a hole (1-18)
export const getStretchForHole = (hole: number): 1 | 2 | 3 => {
  if (hole <= 6) return 1;
  if (hole <= 12) return 2;
  return 3;
};

// Get hole position within stretch (1-6)
export const getHoleInStretch = (hole: number): number => {
  return ((hole - 1) % 6) + 1;
};

// Is this a stretch start hole?
export const isStretchStartHole = (hole: number): boolean => {
  return hole === 1 || hole === 7 || hole === 13;
};

// Is this a stretch end hole?
export const isStretchEndHole = (hole: number): boolean => {
  return hole === 6 || hole === 12 || hole === 18;
};

// Get team assignment from gameData
export const getTeamAssignment = (
  gameData: any,
  gameId: string,
  stretch: 1 | 2 | 3
): Stockton6TeamAssignment | null => {
  const stretchStartHole = (stretch - 1) * 6 + 1;
  const data = gameData?.[gameId]?.[stretchStartHole];
  
  if (!data?._META_TEAM_A || !data?._META_TEAM_B) return null;
  
  return {
    teamA: data._META_TEAM_A,
    teamB: data._META_TEAM_B,
    unitValue: data._META_UNIT_VALUE ?? 5,
    dotValue: data._META_DOT_VALUE ?? 2,
    locked: data._META_LOCKED ?? false,
  };
};

// Calculate net score with triple bogey cap for betting
export const getCappedNetScore = (
  gross: number,
  par: number,
  strokeIndex: number,
  courseHandicap: number,
  overrideStrokes?: number | null
): number => {
  const net = getNetScore(gross, par, strokeIndex, courseHandicap, overrideStrokes);
  const maxNetScore = par + 3; // Triple bogey cap
  return Math.min(net, maxNetScore);
};

// Calculate 1-Ball and 2-Ball results for a single hole
export const calculateHoleBallResults = (
  round: Round,
  hole: number,
  teamA: string[],
  teamB: string[]
): { oneBall: number; twoBall: number } | null => {
  const holeData = round.course.holes.find(h => h.number === hole);
  const holeScores = round.scores[hole];
  
  if (!holeData || !holeScores) return null;
  
  // Calculate relative strokes for all players on this hole
  const relativeStrokes = calculateRelativeStrokes(round.players, holeData.handicapIndex);
  
  // Get net scores for all players using relative handicap strokes
  const getPlayerNet = (playerId: string): number | null => {
    const gross = holeScores[playerId];
    if (typeof gross !== 'number') return null;
    
    const player = round.players.find(p => p.id === playerId);
    if (!player) return null;
    
    // Check for manual override first
    const manualStrokes = round.gameData?.['MANUAL_STROKES']?.[hole]?.[playerId];
    
    // Use manual stroke if set, otherwise use relative stroke calculation
    const effectiveStrokes = manualStrokes !== undefined && manualStrokes !== null 
      ? manualStrokes 
      : relativeStrokes[playerId];
    
    // Apply net score with relative strokes (pass 0 for courseHandicap since we're using explicit strokes)
    return getCappedNetScore(gross, holeData.par, holeData.handicapIndex, 0, effectiveStrokes);
  };
  
  // Calculate team nets
  const teamANets = teamA.map(getPlayerNet).filter((n): n is number => n !== null);
  const teamBNets = teamB.map(getPlayerNet).filter((n): n is number => n !== null);
  
  if (teamANets.length !== 2 || teamBNets.length !== 2) return null;
  
  // 1-Ball: lowest net vs lowest net
  const teamA1Ball = Math.min(...teamANets);
  const teamB1Ball = Math.min(...teamBNets);
  const oneBallResult = teamB1Ball - teamA1Ball; // Positive = Team A wins
  
  // 2-Ball: highest net vs highest net  
  const teamA2Ball = Math.max(...teamANets);
  const teamB2Ball = Math.max(...teamBNets);
  const twoBallResult = teamB2Ball - teamA2Ball; // Positive = Team A wins
  
  return { oneBall: oneBallResult, twoBall: twoBallResult };
};

// Process presses for a side (front or back)
const processPresses = (
  currentUp: number,
  presses: Stockton6PressState[],
  holeResult: number,
  holeInStretch: number,
  sideEndHole: number // 3 for front, 6 for back
): { newUp: number; newPresses: Stockton6PressState[]; newPressesCreated: Stockton6PressState[] } => {
  const newPresses: Stockton6PressState[] = [];
  const newPressesCreated: Stockton6PressState[] = [];
  
  // Update main bet
  const newUp = currentUp + holeResult;
  
  // Update existing presses
  for (const press of presses) {
    if (holeInStretch >= press.startHole) {
      const updatedPress = {
        ...press,
        teamAUp: press.teamAUp + holeResult
      };
      newPresses.push(updatedPress);
      
      // Check if this press triggers a new press
      if (Math.abs(updatedPress.teamAUp) >= 2 && holeInStretch < sideEndHole) {
        newPressesCreated.push({
          startHole: holeInStretch + 1,
          teamAUp: 0
        });
      }
    } else {
      newPresses.push(press);
    }
  }
  
  // Check if main bet triggers a new press
  if (Math.abs(newUp) >= 2 && holeInStretch < sideEndHole) {
    // Only create press if we haven't already created one starting on the next hole
    const nextHole = holeInStretch + 1;
    const existingPress = [...newPresses, ...newPressesCreated].find(p => p.startHole === nextHole);
    if (!existingPress) {
      newPressesCreated.push({
        startHole: nextHole,
        teamAUp: 0
      });
    }
  }
  
  return { newUp, newPresses: [...newPresses, ...newPressesCreated], newPressesCreated };
};

// Calculate ball state for a stretch through a given hole
export const calculateBallState = (
  round: Round,
  gameId: string,
  stretch: 1 | 2 | 3,
  throughHole: number
): { oneBall: Stockton6BallState; twoBall: Stockton6BallState } | null => {
  const teamAssignment = getTeamAssignment(round.gameData, gameId, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB } = teamAssignment;
  const stretchHoles = STRETCH_HOLES[stretch];
  
  // Initialize states
  let oneBall: Stockton6BallState = {
    front: { teamAUp: 0, presses: [] },
    back: { teamAUp: 0, presses: [] },
    overall: { teamAUp: 0 }
  };
  
  let twoBall: Stockton6BallState = {
    front: { teamAUp: 0, presses: [] },
    back: { teamAUp: 0, presses: [] },
    overall: { teamAUp: 0 }
  };
  
  // Process each hole
  for (const hole of stretchHoles) {
    if (hole > throughHole) break;
    
    const holeResult = calculateHoleBallResults(round, hole, teamA, teamB);
    if (!holeResult) continue;
    
    const holeInStretch = getHoleInStretch(hole);
    const isFront = holeInStretch <= 3;
    
    // Update 1-Ball
    if (isFront) {
      const frontResult = processPresses(
        oneBall.front.teamAUp,
        oneBall.front.presses,
        holeResult.oneBall,
        holeInStretch,
        3
      );
      oneBall.front.teamAUp = frontResult.newUp;
      oneBall.front.presses = frontResult.newPresses;
    } else {
      const backResult = processPresses(
        oneBall.back.teamAUp,
        oneBall.back.presses,
        holeResult.oneBall,
        holeInStretch,
        6
      );
      oneBall.back.teamAUp = backResult.newUp;
      oneBall.back.presses = backResult.newPresses;
    }
    oneBall.overall.teamAUp += holeResult.oneBall;
    
    // Update 2-Ball
    if (isFront) {
      const frontResult = processPresses(
        twoBall.front.teamAUp,
        twoBall.front.presses,
        holeResult.twoBall,
        holeInStretch,
        3
      );
      twoBall.front.teamAUp = frontResult.newUp;
      twoBall.front.presses = frontResult.newPresses;
    } else {
      const backResult = processPresses(
        twoBall.back.teamAUp,
        twoBall.back.presses,
        holeResult.twoBall,
        holeInStretch,
        6
      );
      twoBall.back.teamAUp = backResult.newUp;
      twoBall.back.presses = backResult.newPresses;
    }
    twoBall.overall.teamAUp += holeResult.twoBall;
  }
  
  return { oneBall, twoBall };
};

// Get dots for a player on a specific hole
export const getDotsForHole = (
  gameData: any,
  gameId: string,
  hole: number,
  playerId: string
): DotType[] => {
  return gameData?.[gameId]?.[hole]?.dots?.[playerId] || [];
};

// Count dots for a team in a stretch
export const countTeamDots = (
  round: Round,
  gameId: string,
  stretch: 1 | 2 | 3,
  teamPlayerIds: string[]
): number => {
  const stretchHoles = STRETCH_HOLES[stretch];
  let total = 0;
  
  for (const hole of stretchHoles) {
    for (const playerId of teamPlayerIds) {
      const dots = getDotsForHole(round.gameData, gameId, hole, playerId);
      total += dots.length;
    }
  }
  
  return total;
};

// Calculate units won/lost for a ball's side (front or back) including presses
const calculateSideUnits = (
  teamAUp: number,
  presses: Stockton6PressState[],
  baseUnits: number // 1 for front, 2 for back
): number => {
  let totalUnits = 0;
  
  // Main bet
  if (teamAUp > 0) {
    totalUnits += baseUnits; // Team A wins
  } else if (teamAUp < 0) {
    totalUnits -= baseUnits; // Team B wins
  }
  // Tie = push (0 units)
  
  // Presses (1 unit each)
  for (const press of presses) {
    if (press.teamAUp > 0) {
      totalUnits += 1; // Team A wins press
    } else if (press.teamAUp < 0) {
      totalUnits -= 1; // Team B wins press
    }
  }
  
  return totalUnits;
};

// Calculate stretch payouts
export const calculateStretchPayouts = (
  round: Round,
  game: GameSettings,
  stretch: 1 | 2 | 3
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getTeamAssignment(round.gameData, game.id, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue, dotValue } = teamAssignment;
  const stretchEndHole = stretch * 6;
  
  // Check if stretch is complete
  const stretchHoles = STRETCH_HOLES[stretch];
  const allComplete = stretchHoles.every(hole => {
    const holeScores = round.scores[hole];
    if (!holeScores) return false;
    return [...teamA, ...teamB].every(pid => typeof holeScores[pid] === 'number');
  });
  
  if (!allComplete) return null;
  
  const ballState = calculateBallState(round, game.id, stretch, stretchEndHole);
  if (!ballState) return null;
  
  const { oneBall, twoBall } = ballState;
  const details: string[] = [];
  
  // Calculate 1-Ball units
  const oneBallFrontUnits = calculateSideUnits(oneBall.front.teamAUp, oneBall.front.presses, 1);
  const oneBallBackUnits = calculateSideUnits(oneBall.back.teamAUp, oneBall.back.presses, 2);
  const oneBallOverallUnits = oneBall.overall.teamAUp > 0 ? 1 : (oneBall.overall.teamAUp < 0 ? -1 : 0);
  const totalOneBallUnits = oneBallFrontUnits + oneBallBackUnits + oneBallOverallUnits;
  
  // Calculate 2-Ball units
  const twoBallFrontUnits = calculateSideUnits(twoBall.front.teamAUp, twoBall.front.presses, 1);
  const twoBallBackUnits = calculateSideUnits(twoBall.back.teamAUp, twoBall.back.presses, 2);
  const twoBallOverallUnits = twoBall.overall.teamAUp > 0 ? 1 : (twoBall.overall.teamAUp < 0 ? -1 : 0);
  const totalTwoBallUnits = twoBallFrontUnits + twoBallBackUnits + twoBallOverallUnits;
  
  // Calculate dot differential
  const teamADots = countTeamDots(round, game.id, stretch, teamA);
  const teamBDots = countTeamDots(round, game.id, stretch, teamB);
  const netDots = teamADots - teamBDots;
  
  // Calculate payouts
  const oneBallPayout = totalOneBallUnits * unitValue;
  const twoBallPayout = totalTwoBallUnits * unitValue;
  const dotPayout = netDots * dotValue;
  
  // Total Team A advantage (positive = Team A wins)
  const totalTeamAAdvantage = oneBallPayout + twoBallPayout + dotPayout;
  
  // Apply "no-split" rule: each player gets full amount
  const playerPayouts: { [playerId: string]: number } = {};
  
  for (const pid of teamA) {
    playerPayouts[pid] = totalTeamAAdvantage;
  }
  for (const pid of teamB) {
    playerPayouts[pid] = -totalTeamAAdvantage;
  }
  
  // Build details
  details.push(`Stretch ${stretch} (Holes ${stretchHoles[0]}-${stretchHoles[5]}):`);
  details.push(`  1-Ball: Front ${oneBallFrontUnits > 0 ? '+' : ''}${oneBallFrontUnits}u, Back ${oneBallBackUnits > 0 ? '+' : ''}${oneBallBackUnits}u, Overall ${oneBallOverallUnits > 0 ? '+' : ''}${oneBallOverallUnits}u`);
  details.push(`  2-Ball: Front ${twoBallFrontUnits > 0 ? '+' : ''}${twoBallFrontUnits}u, Back ${twoBallBackUnits > 0 ? '+' : ''}${twoBallBackUnits}u, Overall ${twoBallOverallUnits > 0 ? '+' : ''}${twoBallOverallUnits}u`);
  details.push(`  Dots: Team A ${teamADots}, Team B ${teamBDots} (net ${netDots > 0 ? '+' : ''}${netDots})`);
  
  if (totalTeamAAdvantage > 0) {
    details.push(`  → Team A each: +$${totalTeamAAdvantage}`);
  } else if (totalTeamAAdvantage < 0) {
    details.push(`  → Team B each: +$${Math.abs(totalTeamAAdvantage)}`);
  } else {
    details.push(`  → Push (no money changes hands)`);
  }
  
  return { playerPayouts, details };
};
// Calculate dot payouts for a single hole
export const calculateHoleDotPayouts = (
  round: Round,
  gameId: string,
  hole: number
): { playerPayouts: { [playerId: string]: number } } | null => {
  // Determine which stretch this hole belongs to
  const stretch = getStretchForHole(hole);
  
  // Get team assignment for this stretch
  const teamAssignment = getTeamAssignment(round.gameData, gameId, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, dotValue } = teamAssignment;
  
  // Count dots for each team on this specific hole
  let teamADots = 0;
  let teamBDots = 0;
  
  for (const playerId of teamA) {
    const dots = getDotsForHole(round.gameData, gameId, hole, playerId);
    teamADots += dots.length;
  }
  
  for (const playerId of teamB) {
    const dots = getDotsForHole(round.gameData, gameId, hole, playerId);
    teamBDots += dots.length;
  }
  
  // Calculate net dots (positive = Team A advantage)
  const netDots = teamADots - teamBDots;
  const dotPayout = netDots * dotValue;
  
  // Apply "no-split" rule: each player gets full amount
  const playerPayouts: { [playerId: string]: number } = {};
  
  for (const pid of teamA) {
    playerPayouts[pid] = dotPayout;
  }
  for (const pid of teamB) {
    playerPayouts[pid] = -dotPayout;
  }
  
  return { playerPayouts };
};

// Calculate stretch ball payouts (1-Ball and 2-Ball only, no dots)
export const calculateStretchBallPayouts = (
  round: Round,
  game: GameSettings,
  stretch: 1 | 2 | 3
): { playerPayouts: { [playerId: string]: number }; details: string[] } | null => {
  const teamAssignment = getTeamAssignment(round.gameData, game.id, stretch);
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue } = teamAssignment;
  const stretchEndHole = stretch * 6;
  
  // Check if stretch is complete
  const stretchHoles = STRETCH_HOLES[stretch];
  const allComplete = stretchHoles.every(hole => {
    const holeScores = round.scores[hole];
    if (!holeScores) return false;
    return [...teamA, ...teamB].every(pid => typeof holeScores[pid] === 'number');
  });
  
  if (!allComplete) return null;
  
  const ballState = calculateBallState(round, game.id, stretch, stretchEndHole);
  if (!ballState) return null;
  
  const { oneBall, twoBall } = ballState;
  const details: string[] = [];
  
  // Calculate 1-Ball units
  const oneBallFrontUnits = calculateSideUnits(oneBall.front.teamAUp, oneBall.front.presses, 1);
  const oneBallBackUnits = calculateSideUnits(oneBall.back.teamAUp, oneBall.back.presses, 2);
  const oneBallOverallUnits = oneBall.overall.teamAUp > 0 ? 1 : (oneBall.overall.teamAUp < 0 ? -1 : 0);
  const totalOneBallUnits = oneBallFrontUnits + oneBallBackUnits + oneBallOverallUnits;
  
  // Calculate 2-Ball units
  const twoBallFrontUnits = calculateSideUnits(twoBall.front.teamAUp, twoBall.front.presses, 1);
  const twoBallBackUnits = calculateSideUnits(twoBall.back.teamAUp, twoBall.back.presses, 2);
  const twoBallOverallUnits = twoBall.overall.teamAUp > 0 ? 1 : (twoBall.overall.teamAUp < 0 ? -1 : 0);
  const totalTwoBallUnits = twoBallFrontUnits + twoBallBackUnits + twoBallOverallUnits;
  
  // Calculate ball payouts only (no dots)
  const oneBallPayout = totalOneBallUnits * unitValue;
  const twoBallPayout = totalTwoBallUnits * unitValue;
  const ballPayout = oneBallPayout + twoBallPayout;
  
  // Apply "no-split" rule: each player gets full amount
  const playerPayouts: { [playerId: string]: number } = {};
  
  for (const pid of teamA) {
    playerPayouts[pid] = ballPayout;
  }
  for (const pid of teamB) {
    playerPayouts[pid] = -ballPayout;
  }
  
  // Build details
  details.push(`Stretch ${stretch} (Holes ${stretchHoles[0]}-${stretchHoles[5]}):`);
  details.push(`  1-Ball: Front ${oneBallFrontUnits > 0 ? '+' : ''}${oneBallFrontUnits}u, Back ${oneBallBackUnits > 0 ? '+' : ''}${oneBallBackUnits}u, Overall ${oneBallOverallUnits > 0 ? '+' : ''}${oneBallOverallUnits}u`);
  details.push(`  2-Ball: Front ${twoBallFrontUnits > 0 ? '+' : ''}${twoBallFrontUnits}u, Back ${twoBallBackUnits > 0 ? '+' : ''}${twoBallBackUnits}u, Overall ${twoBallOverallUnits > 0 ? '+' : ''}${twoBallOverallUnits}u`);
  
  if (ballPayout > 0) {
    details.push(`  → Team A each: +$${ballPayout} (balls)`);
  } else if (ballPayout < 0) {
    details.push(`  → Team B each: +$${Math.abs(ballPayout)} (balls)`);
  } else {
    details.push(`  → Ball bets push`);
  }
  
  return { playerPayouts, details };
};

// Main calculation function
export const calculateStockton6 = (round: Round, game: GameSettings): GameResult => {
  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];
  
  // Initialize all players to 0
  round.players.forEach(p => {
    results[p.id] = 0;
  });
  
  // Initialize hole results for all holes
  for (let hole = 1; hole <= 18; hole++) {
    holeResults[hole] = {};
    round.players.forEach(p => { holeResults[hole][p.id] = 0; });
  }
  
  // Process EACH hole for dot payouts
  for (let hole = 1; hole <= 18; hole++) {
    // Check if hole has scores for at least one team
    const holeScores = round.scores[hole];
    if (!holeScores) continue;
    
    const dotResult = calculateHoleDotPayouts(round, game.id, hole);
    if (dotResult) {
      // Add dot payouts to this hole's results
      Object.entries(dotResult.playerPayouts).forEach(([pid, amount]) => {
        holeResults[hole][pid] += amount;
        results[pid] += amount;
      });
    }
  }
  
  // Calculate each stretch for 1-Ball/2-Ball payouts (added at stretch-end holes)
  for (const stretch of [1, 2, 3] as const) {
    const stretchResult = calculateStretchBallPayouts(round, game, stretch);
    if (!stretchResult) continue;
    
    // Add to totals
    Object.entries(stretchResult.playerPayouts).forEach(([pid, amount]) => {
      results[pid] += amount;
    });
    
    // Add ball payouts to stretch end hole
    const stretchEndHole = stretch * 6;
    Object.entries(stretchResult.playerPayouts).forEach(([pid, amount]) => {
      holeResults[stretchEndHole][pid] += amount;
    });
    
    // Add details
    details.push(...stretchResult.details);
    details.push('');
  }
  
  return {
    gameId: game.id,
    playerResults: results,
    details,
    holeResults
  };
};

// Validation: Check if totals balance to zero
export const validateStockton6Totals = (results: { [playerId: string]: number }): boolean => {
  const total = Object.values(results).reduce((sum, val) => sum + val, 0);
  return Math.abs(total) < 0.01; // Account for floating point
};
