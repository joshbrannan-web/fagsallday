import { Course, GameSettings, GameType, Player, Round, GameResult, WolfHoleData, FBOPressState } from "../types";
import { calculateStockton6 } from "./stockton6Engine";
import { calculateSixes } from "./sixesEngine";

// --- FBO Stroke Calculation (supports both Absolute and Relative modes) ---

export const calculateFBOStrokes = (
  players: Player[],
  holeHandicapIndex: number,
  handicapMode: 'absolute' | 'relative' = 'absolute'
): { [playerId: string]: number } => {
  const strokes: { [playerId: string]: number } = {};
  
  if (handicapMode === 'relative') {
    // Relative mode: strokes based on differential from lowest handicap player
    const lowestCourseHandicap = Math.min(...players.map(p => p.courseHandicap));
    
    players.forEach(player => {
      const differential = player.courseHandicap - lowestCourseHandicap;
      // Player gets a stroke if their differential >= hole handicap index
      strokes[player.id] = differential >= holeHandicapIndex ? 1 : 0;
    });
  } else {
    // Absolute mode (original logic)
    let playersReceivingStrokes = 0;
    
    players.forEach(player => {
      const getsStroke = holeHandicapIndex <= player.courseHandicap;
      strokes[player.id] = getsStroke ? 1 : 0;
      if (getsStroke) playersReceivingStrokes++;
    });
    
    // If ALL players get a stroke, cancel them all
    if (playersReceivingStrokes === players.length) {
      players.forEach(player => {
        strokes[player.id] = 0;
      });
    }
  }
  
  return strokes;
};

// --- FBO Hole Winner Calculation ---
// Returns array of player IDs who won (lowest net score) - allows ties

export const calculateFBOHoleWinners = (
  round: Round,
  game: GameSettings,
  holeNumber: number
): string[] => {
  // Normalize IDs to strings to handle DB JSON coercion
  const fboPlayerIds = (game.config.fboPlayers || round.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(String(p.id)));
  const hole = round.course.holes.find(h => h.number === holeNumber);
  const holeScores = round.scores[holeNumber];
  
  if (!hole || !holeScores) return [];
  
  // Check all FBO players have scores (> 0)
  const allScored = fboPlayers.every(p => {
    const score = holeScores[p.id];
    return typeof score === 'number' && score > 0;
  });
  if (!allScored) return [];
  
  // Get handicap mode from FBO config
  const handicapMode = game.config.fbo?.handicapMode || 'absolute';
  
  // Calculate strokes using the configured mode
  const strokes = calculateFBOStrokes(fboPlayers, hole.handicapIndex, handicapMode);
  
  // Calculate net scores
  const netScores: { playerId: string; gross: number; strokes: number; net: number }[] = fboPlayers.map(p => ({
    playerId: p.id,
    gross: holeScores[p.id]!,
    strokes: strokes[p.id],
    net: holeScores[p.id]! - strokes[p.id]
  }));
  
  // Find lowest net score(s) - ties allowed
  const lowestNet = Math.min(...netScores.map(s => s.net));
  return netScores.filter(s => s.net === lowestNet).map(s => s.playerId);
};

// Get FBO net score info for UI display
export const getFBOHoleNetScores = (
  round: Round,
  game: GameSettings,
  holeNumber: number
): { playerId: string; gross: number; strokes: number; net: number }[] => {
  // Normalize IDs to strings to handle DB JSON coercion
  const fboPlayerIds = (game.config.fboPlayers || round.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(String(p.id)));
  const hole = round.course.holes.find(h => h.number === holeNumber);
  const holeScores = round.scores[holeNumber];
  
  if (!hole) return [];
  
  // Get handicap mode from FBO config
  const handicapMode = game.config.fbo?.handicapMode || 'absolute';
  
  // Calculate strokes using the configured mode
  const strokes = calculateFBOStrokes(fboPlayers, hole.handicapIndex, handicapMode);
  
  return fboPlayers.map(p => {
    const gross = holeScores?.[p.id] ?? 0;
    return {
      playerId: p.id,
      gross,
      strokes: strokes[p.id],
      net: gross > 0 ? gross - strokes[p.id] : 0
    };
  });
};

// --- Handicap Utilities ---

export const calculateCourseHandicap = (handicapIndex: number, par: number): number => {
  // Simplified logic: Course Handicap = Handicap Index (mocking slope/rating for now)
  // In a real app: (Index * Slope / 113) + (Course Rating - Par)
  return Math.round(handicapIndex);
};

export const calculateStrokesReceived = (courseHandicap: number, strokeIndex: number): number => {
  if (courseHandicap > 0) {
    // e.g. Handicap 18 gets 1 stroke on every hole. Handicap 20 gets 2 on hardest 2 holes.
    const baseStrokes = Math.floor(courseHandicap / 18);
    const remainder = courseHandicap % 18;
    return baseStrokes + (strokeIndex <= remainder ? 1 : 0);
  } else if (courseHandicap < 0) {
    // Plus handicap logic: Give strokes back to course on easiest holes (18, 17...)
    const absHcp = Math.abs(courseHandicap);
    const baseStrokes = Math.floor(absHcp / 18);
    const remainder = absHcp % 18;
    // Remainder 1 => add stroke on Index 18.
    // Logic: If hole stroke index is > (18 - remainder), we add a stroke.
    const addsStroke = strokeIndex > 18 - remainder;
    return -(baseStrokes + (addsStroke ? 1 : 0));
  }
  return 0;
};

// Calculate strokes for a banker matchup
// Returns { playerStrokes, bankerStrokes } based on handicap difference
// The higher handicap player receives strokes if difference >= hole handicap index
export const calculateBankerMatchupStrokes = (
  playerHandicap: number,
  bankerHandicap: number,
  holeHandicapIndex: number,
): { playerStrokes: number; bankerStrokes: number } => {
  const diff = Math.abs(playerHandicap - bankerHandicap);
  
  if (diff < holeHandicapIndex) {
    return { playerStrokes: 0, bankerStrokes: 0 };
  }
  
  if (playerHandicap > bankerHandicap) {
    // Player has higher handicap, player gets stroke
    return { playerStrokes: 1, bankerStrokes: 0 };
  } else if (bankerHandicap > playerHandicap) {
    // Banker has higher handicap, banker gets stroke against this player
    return { playerStrokes: 0, bankerStrokes: 1 };
  }
  
  return { playerStrokes: 0, bankerStrokes: 0 };
};

// Legacy function for backward compatibility - returns player strokes only
export const calculateBankerStrokeReceived = (
  playerHandicap: number,
  bankerHandicap: number,
  holeHandicapIndex: number,
): number => {
  const result = calculateBankerMatchupStrokes(playerHandicap, bankerHandicap, holeHandicapIndex);
  return result.playerStrokes;
};

export const getNetScore = (
  gross: number,
  par: number,
  strokeIndex: number,
  courseHandicap: number,
  overrideStrokes?: number | null, // Optional manual override
): number => {
  if (!gross) return 0;

  let strokesReceived = 0;

  if (overrideStrokes !== undefined && overrideStrokes !== null) {
    strokesReceived = overrideStrokes;
  } else {
    strokesReceived = calculateStrokesReceived(courseHandicap, strokeIndex);
  }

  return gross - strokesReceived;
};

// Deprecated in favor of direct net score comparison for WYSIWYG consistency with manual overrides
export const getMatchStrokesReceived = (
  playerHandicap: number,
  opponentHandicap: number,
  holeStrokeIndex: number,
): number => {
  const diff = playerHandicap - opponentHandicap;
  if (diff === 0) return 0;

  const absDiff = Math.abs(diff);
  const baseStrokes = Math.floor(absDiff / 18);
  const remainder = absDiff % 18;
  const extraStroke = holeStrokeIndex <= remainder ? 1 : 0;
  const totalStrokes = baseStrokes + extraStroke;

  return diff > 0 ? totalStrokes : 0;
};

// --- Universal Stroke Calculation for Games ---
// Respects game's handicap configuration (useHandicaps, handicapMode)
// Returns the number of strokes a player receives on a specific hole

export const calculateGameStrokes = (
  round: Round,
  game: GameSettings,
  holeNumber: number,
  playerId: string,
  referencePlayerId?: string // For relative mode (e.g., banker or lowest handicap player)
): number => {
  // Check for manual override first - this always takes precedence
  const manualStrokes = round.gameData?.["MANUAL_STROKES"]?.[holeNumber]?.[playerId];
  if (manualStrokes !== undefined && manualStrokes !== null) {
    return manualStrokes;
  }

  // If handicaps are disabled for this game, return 0
  if (!game.config.useHandicaps) {
    return 0;
  }

  const player = round.players.find((p) => p.id === playerId);
  const hole = round.course.holes.find((h) => h.number === holeNumber);
  if (!player || !hole) return 0;

  if (game.config.handicapMode === 'absolute') {
    // Stockton 6 style: stroke if holeIndex <= courseHandicap
    // Cancel if ALL players would get strokes (strokes cancel out)
    const allPlayersGetStrokes = round.players.every(
      (p) => hole.handicapIndex <= p.courseHandicap
    );
    if (allPlayersGetStrokes) return 0;
    
    return hole.handicapIndex <= player.courseHandicap ? 1 : 0;
  } else {
    // Relative mode (Banker style): strokes based on differential from reference player
    let refPlayerId = referencePlayerId;
    
    if (!refPlayerId) {
      // Find lowest handicap player as reference
      const lowestHandicapPlayer = round.players.reduce(
        (min, p) => (p.courseHandicap < min.courseHandicap ? p : min),
        round.players[0]
      );
      refPlayerId = lowestHandicapPlayer.id;
    }

    const refPlayer = round.players.find((p) => p.id === refPlayerId);
    if (!refPlayer || refPlayer.id === playerId) return 0;

    const diff = player.courseHandicap - refPlayer.courseHandicap;
    if (diff <= 0) return 0;
    
    // Player gets a stroke if diff >= hole handicap index
    if (diff >= hole.handicapIndex) return 1;
    return 0;
  }
};

// --- Betting Engine ---

export const calculateSkins = (round: Round, game: GameSettings): GameResult => {
  const { players, scores, course } = round;
  const unit = game.unitStake;
  const carryovers = game.config.carryovers ?? true;

  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};

  players.forEach((p) => (results[p.id] = 0));

  const details: string[] = [];
  let currentPot = unit;

  // Iterate holes 1 to however many defined
  for (let h = 1; h <= course.holes.length; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores) break; // Future hole

    // Check if all players have scores
    const activePlayers = players.filter((p) => typeof holeScores[p.id] === "number");
    if (activePlayers.length < players.length) break; // Incomplete hole

    // Calculate net scores using game's handicap configuration
    const nets = activePlayers.map((p) => {
      const gross = holeScores[p.id]!;
      // Use calculateGameStrokes which respects manual overrides and game config
      const effectiveStrokes = calculateGameStrokes(round, game, h, p.id);
      return {
        id: p.id,
        net: gross - effectiveStrokes,
      };
    });

    // Find min score
    const minScore = Math.min(...nets.map((n) => n.net));
    const winners = nets.filter((n) => n.net === minScore);

    holeResults[h] = {}; // Init hole result

    if (winners.length === 1) {
      // One winner takes the pot
      const winnerId = winners[0].id;
      const winAmountPerPlayer = currentPot;

      players.forEach((p) => {
        let amount = 0;
        if (p.id === winnerId) {
          amount = winAmountPerPlayer * (players.length - 1);
        } else {
          amount = -winAmountPerPlayer;
        }

        results[p.id] += amount;
        holeResults[h][p.id] = amount;
      });

      const winnerName = players.find((p) => p.id === winnerId)?.name;
      details.push(
        `Hole ${h}: ${winnerName} wins $${currentPot * (players.length - 1)} skin${
          currentPot > unit ? " (with carryovers)" : ""
        }`,
      );

      currentPot = unit; // Reset pot
    } else {
      // Tie - carry over or split
      if (carryovers) {
        currentPot += unit;
        details.push(`Hole ${h}: Tie - pot carries over to $${currentPot * (players.length - 1)}`);
      } else {
        details.push(`Hole ${h}: Tie - no carryover`);
      }
      // No money changes hands on this hole
      players.forEach((p) => {
        holeResults[h][p.id] = 0;
      });
    }
  }

  return { gameId: game.id, playerResults: results, details, holeResults };
};

export const calculateNassau = (round: Round, game: GameSettings): GameResult => {
  const { players, scores, course } = round;
  const unit = game.unitStake;

  if (players.length !== 2) {
    return {
      gameId: game.id,
      playerResults: {},
      details: ["Nassau requires exactly 2 players"],
    };
  }

  const [p1, p2] = players;
  const results: { [id: string]: number } = { [p1.id]: 0, [p2.id]: 0 };
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];

  let front9Score = { [p1.id]: 0, [p2.id]: 0 };
  let back9Score = { [p1.id]: 0, [p2.id]: 0 };

  for (let h = 1; h <= course.holes.length; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores || typeof holeScores[p1.id] !== "number" || typeof holeScores[p2.id] !== "number") {
      break;
    }

    holeResults[h] = { [p1.id]: 0, [p2.id]: 0 };

    // Use calculateGameStrokes which respects manual overrides and game config
    const effectiveStrokes1 = calculateGameStrokes(round, game, h, p1.id);
    const effectiveStrokes2 = calculateGameStrokes(round, game, h, p2.id);
    const net1 = holeScores[p1.id]! - effectiveStrokes1;
    const net2 = holeScores[p2.id]! - effectiveStrokes2;

    const scoreDiff = h <= 9 ? front9Score : back9Score;

    if (net1 < net2) {
      scoreDiff[p1.id] += 1;
    } else if (net2 < net1) {
      scoreDiff[p2.id] += 1;
    }
  }

  // Calculate payouts
  const calculatePayout = (score: { [id: string]: number }, label: string) => {
    const diff = score[p1.id] - score[p2.id];
    if (diff > 0) {
      results[p1.id] += unit;
      results[p2.id] -= unit;
      details.push(`${label}: ${p1.name} wins $${unit}`);
    } else if (diff < 0) {
      results[p2.id] += unit;
      results[p1.id] -= unit;
      details.push(`${label}: ${p2.name} wins $${unit}`);
    } else {
      details.push(`${label}: Push (tie)`);
    }
  };

  calculatePayout(front9Score, "Front 9");
  calculatePayout(back9Score, "Back 9");

  // Overall
  const overallScore = {
    [p1.id]: front9Score[p1.id] + back9Score[p1.id],
    [p2.id]: front9Score[p2.id] + back9Score[p2.id],
  };
  calculatePayout(overallScore, "Overall");

  return { gameId: game.id, playerResults: results, details, holeResults };
};

export const calculateOpenBetting = (round: Round, game: GameSettings): GameResult => {
  const { players } = round;
  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};

  players.forEach((p) => (results[p.id] = 0));

  const openBetData = round.gameData?.[game.id] || {};

  Object.entries(openBetData).forEach(([holeStr, holeBets]: [string, any]) => {
    const holeNum = parseInt(holeStr);
    holeResults[holeNum] = {};

    if (typeof holeBets === "object") {
      Object.entries(holeBets).forEach(([playerId, amount]: [string, any]) => {
        const numAmount = Number(amount) || 0;
        results[playerId] = (results[playerId] || 0) + numAmount;
        holeResults[holeNum][playerId] = numAmount;
      });
    }
  });

  return {
    gameId: game.id,
    playerResults: results,
    details: ["Open betting - manual adjustments"],
    holeResults,
  };
};

export const calculateBanker = (round: Round, game: GameSettings): GameResult => {
  const { players, scores, course } = round;
  const unit = game.unitStake;
  // Support new multiplier config, fallback to legacy boolean config
  const birdieMultiplier = game.config.birdieMultiplier ?? (game.config.birdieTriple ? 3 : 1);
  const eagleMultiplier = game.config.eagleMultiplier ?? (game.config.eagleQuintuple ? 5 : 1);

  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};

  players.forEach((p) => (results[p.id] = 0));

  const bankerData = round.gameData?.[game.id] || {};

  for (let h = 1; h <= course.holes.length; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores) break;

    holeResults[h] = {};
    players.forEach((p) => (holeResults[h][p.id] = 0));

    const holeBankerData = bankerData[h];
    if (!holeBankerData) continue;

    // Support both old format (bankerId) and new format (_META_BANKER_ID)
    const bankerId = holeBankerData["_META_BANKER_ID"] || holeBankerData.bankerId;
    if (!bankerId) continue;

    const banker = players.find((p) => p.id === bankerId);
    if (!banker) continue;

    const bankerGross = holeScores[bankerId];
    if (typeof bankerGross !== "number") continue;

    // Get base multiplier for banker (support both formats)
    let bankerBaseMultiplier = holeBankerData["_META_BANKER_MULT"] || holeBankerData.bankerMultiplier || 1;

    // Apply score-based multipliers
    const bankerToPar = bankerGross - holeData.par;
    if (eagleMultiplier > 1 && bankerToPar <= -2) {
      bankerBaseMultiplier *= eagleMultiplier;
    } else if (birdieMultiplier > 1 && bankerToPar === -1) {
      bankerBaseMultiplier *= birdieMultiplier;
    }

    // Calculate against each non-banker player
    players.forEach((p) => {
      if (p.id === bankerId) return;

      const playerGross = holeScores[p.id];
      if (typeof playerGross !== "number") return;

      // Calculate strokes based on game's handicap configuration
      let playerStrokesReceived = 0;
      let bankerStrokesReceived = 0;

      // Check for manual stroke override first
      const playerManualStrokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p.id];
      const bankerManualStrokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[`${bankerId}_vs_${p.id}`];

      if (playerManualStrokes !== undefined && playerManualStrokes !== null) {
        // Use manual override if set for player
        playerStrokesReceived = playerManualStrokes;
        bankerStrokesReceived = 0;
      } else if (bankerManualStrokes !== undefined && bankerManualStrokes !== null) {
        // Use manual override if set for banker
        playerStrokesReceived = 0;
        bankerStrokesReceived = bankerManualStrokes;
      } else if (game.config.useHandicaps) {
        // Auto-calculate strokes based on handicap mode
        if (game.config.handicapMode === 'absolute') {
          // Stockton 6 style: each player gets strokes independently
          // Cancel if ALL players would get strokes
          const allPlayersGetStrokes = players.every(
            (pl) => holeData.handicapIndex <= pl.courseHandicap
          );
          if (!allPlayersGetStrokes) {
            playerStrokesReceived = holeData.handicapIndex <= p.courseHandicap ? 1 : 0;
            bankerStrokesReceived = holeData.handicapIndex <= banker.courseHandicap ? 1 : 0;
          }
        } else {
          // Relative mode (default Banker style): strokes based on differential
          const matchupStrokes = calculateBankerMatchupStrokes(
            p.courseHandicap,
            banker.courseHandicap,
            holeData.handicapIndex,
          );
          playerStrokesReceived = matchupStrokes.playerStrokes;
          bankerStrokesReceived = matchupStrokes.bankerStrokes;
        }
      }
      // If useHandicaps is false and no manual override, both remain 0

      const playerNet = playerGross - playerStrokesReceived;
      const bankerNet = bankerGross - bankerStrokesReceived;

      // Get player-specific multiplier (stored directly under player ID in new format)
      let playerMultiplier = holeBankerData[p.id] || holeBankerData.playerMultipliers?.[p.id] || 1;
      // Filter out non-numeric values (like _META keys stored as strings)
      if (typeof playerMultiplier !== "number") playerMultiplier = 1;

      // Apply score-based multipliers for player too
      const playerToPar = playerGross - holeData.par;
      if (eagleMultiplier > 1 && playerToPar <= -2) {
        playerMultiplier *= eagleMultiplier;
      } else if (birdieMultiplier > 1 && playerToPar === -1) {
        playerMultiplier *= birdieMultiplier;
      }

      // For Bloody Banker on holes 16, 17, 18: custom stake becomes the BASE BET
      // Formula: Base Bet × Banker Multiplier (Double All) × Player Multiplier = Final Bet
      let payout: number;
      if (game.type === GameType.BLOODY_BANKER && h >= 16 && h <= 18) {
        const customStake = holeBankerData[`_STAKE_${p.id}`];
        if (customStake !== undefined && customStake > 0) {
          // Custom stake is the new base bet
          // Multiply by bankerBaseMultiplier (Double All, Triple All, etc.) AND player multiplier
          const effectiveMultiplier = bankerBaseMultiplier * playerMultiplier;
          payout = customStake * effectiveMultiplier;
        } else {
          // No custom stake set, use default calculation
          const effectiveMultiplier = bankerBaseMultiplier * playerMultiplier;
          payout = unit * effectiveMultiplier;
        }
      } else {
        const effectiveMultiplier = bankerBaseMultiplier * playerMultiplier;
        payout = unit * effectiveMultiplier;
      }

      if (bankerNet < playerNet) {
        // Banker wins
        results[bankerId] += payout;
        results[p.id] -= payout;
        holeResults[h][bankerId] += payout;
        holeResults[h][p.id] -= payout;
      } else if (playerNet < bankerNet) {
        // Player wins
        results[p.id] += payout;
        results[bankerId] -= payout;
        holeResults[h][p.id] += payout;
        holeResults[h][bankerId] -= payout;
      }
      // Tie = no money changes hands
    });
  }

  return {
    gameId: game.id,
    playerResults: results,
    details: ["Banker game results"],
    holeResults,
  };
};

// --- FBO Dormie Detection ---

// Check if a player is dormie (mathematically cannot win a segment)
export const isFBOPlayerDormie = (
  playerDots: number,
  leaderDots: number,
  holesRemaining: number
): boolean => {
  // Player is dormie if they can't catch the leader even winning all remaining holes
  return playerDots + holesRemaining < leaderDots;
};

// Get dormie status for all players in a segment
export const getFBODormieStatus = (
  round: Round,
  game: GameSettings,
  currentHole: number
): { [playerId: string]: { isDormie: boolean; dotsBehind: number; holesRemaining: number; segment: 'front' | 'back' } } => {
  const fboPlayerIds = game.config.fboPlayers || round.players.map(p => p.id);
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(p.id));
  const fboData = round.gameData?.[game.id] || {};
  
  // Determine which segment we're in
  const segment: 'front' | 'back' = currentHole <= 9 ? 'front' : 'back';
  const segmentStart = segment === 'front' ? 1 : 10;
  const segmentEnd = segment === 'front' ? 9 : 18;
  const holesRemaining = segmentEnd - currentHole + 1;
  
  // Count dots earned so far in this segment
  const dotCounts: { [id: string]: number } = {};
  fboPlayers.forEach(p => dotCounts[p.id] = 0);
  
  for (let h = segmentStart; h < currentHole; h++) {
    const holeDots = fboData[h]?.dots || [];
    holeDots.forEach((playerId: string) => {
      if (dotCounts[playerId] !== undefined) {
        dotCounts[playerId]++;
      }
    });
  }
  
  // Find the leader
  const maxDots = Math.max(...Object.values(dotCounts));
  
  // Calculate dormie status for each player
  const result: { [playerId: string]: { isDormie: boolean; dotsBehind: number; holesRemaining: number; segment: 'front' | 'back' } } = {};
  
  fboPlayers.forEach(p => {
    const playerDots = dotCounts[p.id];
    const isDormie = isFBOPlayerDormie(playerDots, maxDots, holesRemaining);
    result[p.id] = {
      isDormie,
      dotsBehind: maxDots - playerDots,
      holesRemaining,
      segment
    };
  });
  
  return result;
};

// Check if a player already has a press for this segment (legacy - still used for backward compatibility)
// A player can only have one press per segment (front/back)
export const hasExistingFBOPress = (
  round: Round,
  gameId: string,
  playerId: string,
  segment: 'front' | 'back',
  afterHole: number // Kept for API compatibility but not used
): boolean => {
  // Fix: Read from hole 1 where presses are actually stored
  const fboGameData = round.gameData?.[gameId] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  
  // A player can only have one press per segment
  return presses.some(p => 
    String(p.playerId) === String(playerId) && 
    p.segment === segment
  );
};

// Check if a player is dormie on their active press bet
export const isFBOPlayerDormieOnPress = (
  round: Round,
  game: GameSettings,
  playerId: string,
  press: FBOPressState,
  currentHole: number
): boolean => {
  const fboPlayerIds = (game.config.fboPlayers || round.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(String(p.id)));
  const fboData = round.gameData?.[game.id] || {};
  
  const segmentEnd = press.segment === 'front' ? 9 : 18;
  const holesRemaining = segmentEnd - currentHole + 1;
  
  // Count dots from press.startHole to currentHole-1 (completed holes)
  const pressDots: { [id: string]: number } = {};
  fboPlayers.forEach(p => pressDots[String(p.id)] = 0);
  
  for (let h = press.startHole; h < currentHole; h++) {
    const holeDots: (string | number)[] = fboData[h]?.dots || [];
    holeDots.forEach((pid: string | number) => {
      const normalizedId = String(pid);
      if (pressDots[normalizedId] !== undefined) {
        pressDots[normalizedId]++;
      }
    });
  }
  
  const playerDots = pressDots[String(playerId)] || 0;
  const leaderDots = Math.max(...Object.values(pressDots), 0);
  
  // Dormie if can't catch up even winning all remaining holes
  return playerDots + holesRemaining < leaderDots;
};

// Get press eligibility for a player (supports double/triple press)
export const getFBOPressEligibility = (
  round: Round,
  game: GameSettings,
  playerId: string,
  segment: 'front' | 'back',
  currentHole: number
): { canPress: boolean; pressLevel: number; reason?: string } => {
  const fboGameData = round.gameData?.[game.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  
  // Find all presses by this player in this segment
  const playerPresses = presses.filter(p => 
    String(p.playerId) === String(playerId) && 
    p.segment === segment
  );
  
  if (playerPresses.length === 0) {
    // No existing press - check base dormie status
    const dormieStatus = getFBODormieStatus(round, game, currentHole);
    const status = dormieStatus[playerId];
    if (!status?.isDormie) {
      return { canPress: false, pressLevel: 1, reason: 'Not dormie' };
    }
    return { canPress: true, pressLevel: 1 };
  }
  
  // Has existing press(es) - check if dormie on the most recent press
  const latestPress = playerPresses.reduce((a, b) => 
    a.startHole > b.startHole ? a : b
  );
  
  const nextPressLevel = (latestPress.pressLevel || 1) + 1;
  
  // Can't press again on same hole as latest press
  if (latestPress.startHole >= currentHole) {
    return { canPress: false, pressLevel: nextPressLevel, reason: 'Already pressed this hole' };
  }
  
  const isDormieOnPress = isFBOPlayerDormieOnPress(round, game, playerId, latestPress, currentHole);
  if (!isDormieOnPress) {
    return { canPress: false, pressLevel: nextPressLevel, reason: 'Not dormie on current press' };
  }
  
  return { canPress: true, pressLevel: nextPressLevel };
};

// Get dormie status for Overall segment (all 18 holes)
export const getFBOOverallDormieStatus = (
  round: Round,
  game: GameSettings,
  currentHole: number
): { [playerId: string]: { isDormie: boolean; dotsBehind: number; holesRemaining: number } } => {
  const fboPlayerIds = (game.config.fboPlayers || round.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(String(p.id)));
  const fboData = round.gameData?.[game.id] || {};
  
  const holesRemaining = 18 - currentHole + 1;
  
  // Count dots earned so far (holes 1 to currentHole-1)
  const dotCounts: { [id: string]: number } = {};
  fboPlayers.forEach(p => dotCounts[p.id] = 0);
  
  for (let h = 1; h < currentHole; h++) {
    const holeDots: (string | number)[] = fboData[h]?.dots || [];
    holeDots.forEach((playerId: string | number) => {
      const normalizedId = String(playerId);
      if (dotCounts[normalizedId] !== undefined) {
        dotCounts[normalizedId]++;
      }
    });
  }
  
  // Find the leader
  const maxDots = Math.max(...Object.values(dotCounts), 0);
  
  // Calculate dormie status for each player
  const result: { [playerId: string]: { isDormie: boolean; dotsBehind: number; holesRemaining: number } } = {};
  
  fboPlayers.forEach(p => {
    const playerDots = dotCounts[p.id] || 0;
    const isDormie = playerDots + holesRemaining < maxDots;
    result[p.id] = {
      isDormie,
      dotsBehind: maxDots - playerDots,
      holesRemaining
    };
  });
  
  return result;
};

// Check if a player is dormie on their active Overall press bet
export const isFBOPlayerDormieOnOverallPress = (
  round: Round,
  game: GameSettings,
  playerId: string,
  press: FBOPressState,
  currentHole: number
): boolean => {
  const fboPlayerIds = (game.config.fboPlayers || round.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = round.players.filter(p => fboPlayerIds.includes(String(p.id)));
  const fboData = round.gameData?.[game.id] || {};
  
  const holesRemaining = 18 - currentHole + 1;
  
  // Count dots from press.startHole to currentHole-1 (completed holes)
  const pressDots: { [id: string]: number } = {};
  fboPlayers.forEach(p => pressDots[String(p.id)] = 0);
  
  for (let h = press.startHole; h < currentHole; h++) {
    const holeDots: (string | number)[] = fboData[h]?.dots || [];
    holeDots.forEach((pid: string | number) => {
      const normalizedId = String(pid);
      if (pressDots[normalizedId] !== undefined) {
        pressDots[normalizedId]++;
      }
    });
  }
  
  const playerDots = pressDots[String(playerId)] || 0;
  const leaderDots = Math.max(...Object.values(pressDots), 0);
  
  // Dormie if can't catch up even winning all remaining holes
  return playerDots + holesRemaining < leaderDots;
};

// Get press eligibility for Overall segment
export const getFBOPressEligibilityOverall = (
  round: Round,
  game: GameSettings,
  playerId: string,
  currentHole: number
): { canPress: boolean; pressLevel: number; reason?: string } => {
  // Only available on back 9 (holes 10-18)
  if (currentHole <= 9) {
    return { canPress: false, pressLevel: 1, reason: 'Overall presses only available on back 9' };
  }
  
  const fboGameData = round.gameData?.[game.id] || {};
  const presses: FBOPressState[] = fboGameData[1]?._META_PRESSES || [];
  
  // Find all Overall presses by this player
  const playerOverallPresses = presses.filter(p => 
    String(p.playerId) === String(playerId) && 
    p.segment === 'overall'
  );
  
  if (playerOverallPresses.length === 0) {
    // No existing Overall press - check base dormie status for Overall
    const overallDormieStatus = getFBOOverallDormieStatus(round, game, currentHole);
    const status = overallDormieStatus[playerId];
    if (!status?.isDormie) {
      return { canPress: false, pressLevel: 1, reason: 'Not dormie on Overall' };
    }
    return { canPress: true, pressLevel: 1 };
  }
  
  // Has existing Overall press(es) - check if dormie on the most recent one
  const latestPress = playerOverallPresses.reduce((a, b) => 
    a.startHole > b.startHole ? a : b
  );
  
  const nextPressLevel = (latestPress.pressLevel || 1) + 1;
  
  // Can't press again on same hole as latest press
  if (latestPress.startHole >= currentHole) {
    return { canPress: false, pressLevel: nextPressLevel, reason: 'Already pressed this hole' };
  }
  
  const isDormieOnPress = isFBOPlayerDormieOnOverallPress(round, game, playerId, latestPress, currentHole);
  if (!isDormieOnPress) {
    return { canPress: false, pressLevel: nextPressLevel, reason: 'Not dormie on current Overall press' };
  }
  
  return { canPress: true, pressLevel: nextPressLevel };
};

// --- FBO (Front/Back/Overall) ---

export const calculateFBO = (round: Round, game: GameSettings): GameResult => {
  const { players, course, scores } = round;
  const unit = game.unitStake;
  
  // Get players participating in this FBO game (normalize IDs to strings)
  const fboPlayerIds = (game.config.fboPlayers || players.map(p => p.id)).map(id => String(id));
  const fboPlayers = players.filter(p => fboPlayerIds.includes(String(p.id)));
  
  if (fboPlayers.length < 2) {
    return {
      gameId: game.id,
      playerResults: {},
      details: ["FBO requires at least 2 players"],
    };
  }

  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];

  // Initialize results for all FBO players
  fboPlayers.forEach((p) => (results[p.id] = 0));

  // Determine which holes have been completed (all FBO players have a score)
  const completedHoles = new Set<number>();
  for (let h = 1; h <= course.holes.length; h++) {
    const holeScores = scores[h];
    if (!holeScores) continue;
    
    // Check if all FBO players have completed this hole
    const allPlayersScored = fboPlayers.every(p => {
      const score = holeScores[p.id];
      return score !== undefined && score !== null && score > 0;
    });
    if (allPlayersScored) {
      completedHoles.add(h);
    }
  }

  // Check if segments are complete
  const frontNineComplete = [1, 2, 3, 4, 5, 6, 7, 8, 9].every(h => completedHoles.has(h));
  const backNineComplete = [10, 11, 12, 13, 14, 15, 16, 17, 18].every(h => completedHoles.has(h));
  const overallComplete = frontNineComplete && backNineComplete;

  // Get dot data from gameData
  const fboData = round.gameData?.[game.id] || {};
  
  // Count dots per player per segment
  const dotCounts: { front: { [id: string]: number }; back: { [id: string]: number }; overall: { [id: string]: number } } = {
    front: {},
    back: {},
    overall: {}
  };
  
  fboPlayers.forEach(p => {
    dotCounts.front[p.id] = 0;
    dotCounts.back[p.id] = 0;
    dotCounts.overall[p.id] = 0;
  });

  // Count dots from each hole
  for (let h = 1; h <= course.holes.length; h++) {
    const holeDots = fboData[h]?.dots || [];
    
    holeResults[h] = {};
    fboPlayers.forEach(p => holeResults[h][p.id] = 0);
    
    holeDots.forEach((playerId: string | number) => {
      const normalizedId = String(playerId);
      if (dotCounts.overall[normalizedId] !== undefined) {
        dotCounts.overall[normalizedId]++;
        if (h <= 9) {
          dotCounts.front[normalizedId]++;
        } else {
          dotCounts.back[normalizedId]++;
        }
      }
    });
  }

  // Check game mode
  const gameMode = game.config.fbo?.gameMode || 'together';
  const headToHeadMatchups = game.config.fbo?.headToHeadMatchups || [];

  if (gameMode === 'headToHead' && headToHeadMatchups.length > 0) {
    // Head-to-Head Mode: Calculate each matchup independently
    headToHeadMatchups.forEach((matchup: { player1Id: string; player2Id: string; unitValue: number }) => {
      const p1 = fboPlayers.find(p => p.id === matchup.player1Id);
      const p2 = fboPlayers.find(p => p.id === matchup.player2Id);
      if (!p1 || !p2) return;

      const calculateH2HSegment = (segment: 'front' | 'back' | 'overall', isComplete: boolean, label: string) => {
        if (!isComplete) {
          details.push(`${p1.name} vs ${p2.name} - ${label}: In progress`);
          return;
        }

        const p1Dots = dotCounts[segment][p1.id] || 0;
        const p2Dots = dotCounts[segment][p2.id] || 0;

        if (p1Dots > p2Dots) {
          results[p1.id] += matchup.unitValue;
          results[p2.id] -= matchup.unitValue;
          details.push(`${p1.name} vs ${p2.name} - ${label}: ${p1.name} wins $${matchup.unitValue} (${p1Dots} vs ${p2Dots} dots)`);
        } else if (p2Dots > p1Dots) {
          results[p2.id] += matchup.unitValue;
          results[p1.id] -= matchup.unitValue;
          details.push(`${p1.name} vs ${p2.name} - ${label}: ${p2.name} wins $${matchup.unitValue} (${p2Dots} vs ${p1Dots} dots)`);
        } else {
          details.push(`${p1.name} vs ${p2.name} - ${label}: Push (${p1Dots} dots each)`);
        }
      };

      calculateH2HSegment('front', frontNineComplete, 'Front 9');
      calculateH2HSegment('back', backNineComplete, 'Back 9');
      calculateH2HSegment('overall', overallComplete, 'Overall');
    });
  } else {
    // All Together Mode (original behavior)
    const calculateSegmentWinner = (segment: { [id: string]: number }, label: string) => {
      const maxDots = Math.max(...Object.values(segment));
      if (maxDots === 0) {
        details.push(`${label}: No dots awarded - Push`);
        return;
      }
      
      const winners = Object.entries(segment).filter(([_, dots]) => dots === maxDots);
      const losers = Object.entries(segment).filter(([_, dots]) => dots < maxDots);
      
      if (winners.length === 1) {
        // Single winner takes from all losers
        const winnerId = winners[0][0];
        const winnerName = fboPlayers.find(p => p.id === winnerId)?.name;
        const winAmount = unit * losers.length;
        
        results[winnerId] += winAmount;
        losers.forEach(([loserId]) => {
          results[loserId] -= unit;
        });
        
        details.push(`${label}: ${winnerName} wins $${winAmount} (${maxDots} dots)`);
      } else {
        // Multiple winners tie - they split from the losers
        if (losers.length > 0) {
          const totalFromLosers = unit * losers.length;
          const perWinner = totalFromLosers / winners.length;
          
          winners.forEach(([winnerId]) => {
            results[winnerId] += perWinner;
          });
          losers.forEach(([loserId]) => {
            results[loserId] -= unit;
          });
          
          const winnerNames = winners.map(([id]) => fboPlayers.find(p => p.id === id)?.name).join(', ');
          details.push(`${label}: ${winnerNames} tie with ${maxDots} dots each - split $${totalFromLosers}`);
        } else {
          // All players tied
          details.push(`${label}: All players tied with ${maxDots} dots - Push`);
        }
      }
    };

    // Only calculate payouts for completed segments
    if (frontNineComplete) {
      calculateSegmentWinner(dotCounts.front, 'Front 9');
    } else {
      details.push('Front 9: In progress');
    }
    
    if (backNineComplete) {
      calculateSegmentWinner(dotCounts.back, 'Back 9');
    } else {
      details.push('Back 9: In progress');
    }
    
    if (overallComplete) {
      calculateSegmentWinner(dotCounts.overall, 'Overall');
    } else {
      details.push('Overall: In progress');
    }
  }

  // Process FBO presses if enabled
  // Fix: Read presses from hole 1 where they are stored by ActiveRound
  const fboGameDataForPresses = round.gameData?.[game.id] || {};
  const presses: FBOPressState[] = fboGameDataForPresses[1]?._META_PRESSES || [];
  
  if (presses.length > 0) {
    presses.forEach((press, idx) => {
      if (press.settled) {
        // Already settled - apply result
        if (press.result && press.result.winnerId) {
          const winner = fboPlayers.find(p => p.id === press.result!.winnerId);
          if (winner) {
            results[press.result.winnerId] += press.result.amount;
            // Deduct from other players
            fboPlayers.forEach(p => {
              if (p.id !== press.result!.winnerId) {
                results[p.id] -= press.result!.amount / (fboPlayers.length - 1);
              }
            });
          }
        }
        return;
      }

      // Calculate press result - handle 'overall' segment
      const isSegmentComplete = press.segment === 'front' ? frontNineComplete :
                                press.segment === 'back' ? backNineComplete :
                                overallComplete; // 'overall' requires full round complete
      
      const segmentLabel = press.segment === 'front' ? 'Front' : 
                           press.segment === 'back' ? 'Back' : 
                           'Overall';
      
      if (!isSegmentComplete) {
        details.push(`Press #${idx + 1} (${segmentLabel} from hole ${press.startHole}): In progress`);
        return;
      }

      // Count dots in press range (from startHole to segment end)
      const pressEnd = press.segment === 'front' ? 9 : 18;
      
      const pressingPlayer = fboPlayers.find(p => p.id === String(press.playerId));
      const pressLevelLabel = (press.pressLevel || 1) > 1 ? ` (${press.pressLevel}x)` : '';

      // Check if this is a Head-to-Head press (has opponentId)
      if (press.opponentId) {
        // H2H Press: only compare pressing player vs specific opponent
        const opponent = fboPlayers.find(p => p.id === String(press.opponentId));
        if (!opponent) return;

        let p1Dots = 0;
        let p2Dots = 0;
        
        for (let h = press.startHole; h <= pressEnd; h++) {
          const holeDots: (string | number)[] = fboData[h]?.dots || [];
          holeDots.forEach((pid: string | number) => {
            const normalizedId = String(pid);
            if (normalizedId === String(press.playerId)) p1Dots++;
            if (normalizedId === String(press.opponentId)) p2Dots++;
          });
        }

        if (p1Dots > p2Dots) {
          // Pressing player won
          results[press.playerId] = (results[press.playerId] || 0) + press.unitValue;
          results[press.opponentId] = (results[press.opponentId] || 0) - press.unitValue;
          details.push(`Press${pressLevelLabel} by ${pressingPlayer?.name} vs ${opponent.name} (${segmentLabel} from hole ${press.startHole}): ${pressingPlayer?.name} wins $${press.unitValue}`);
        } else if (p2Dots > p1Dots) {
          // Opponent won
          results[press.opponentId] = (results[press.opponentId] || 0) + press.unitValue;
          results[press.playerId] = (results[press.playerId] || 0) - press.unitValue;
          details.push(`Press${pressLevelLabel} by ${pressingPlayer?.name} vs ${opponent.name} (${segmentLabel} from hole ${press.startHole}): ${opponent.name} wins $${press.unitValue}`);
        } else {
          // Push
          details.push(`Press${pressLevelLabel} by ${pressingPlayer?.name} vs ${opponent.name} (${segmentLabel} from hole ${press.startHole}): Push`);
        }
      } else {
        // Global pool press (original behavior)
        const pressDots: { [id: string]: number } = {};
        fboPlayers.forEach(p => pressDots[p.id] = 0);
        
        for (let h = press.startHole; h <= pressEnd; h++) {
          const holeDots = fboData[h]?.dots || [];
          holeDots.forEach((playerId: string | number) => {
            const normalizedId = String(playerId);
            if (pressDots[normalizedId] !== undefined) {
              pressDots[normalizedId]++;
            }
          });
        }

        // Determine press winner
        const maxPressDots = Math.max(...Object.values(pressDots));
        const pressWinners = Object.entries(pressDots).filter(([_, dots]) => dots === maxPressDots);
        const pressLosers = Object.entries(pressDots).filter(([_, dots]) => dots < maxPressDots);
        
        if (pressWinners.length === 1 && maxPressDots > 0) {
          const winnerId = pressWinners[0][0];
          const winnerName = fboPlayers.find(p => p.id === winnerId)?.name;
          const winAmount = press.unitValue * pressLosers.length;
          
          results[winnerId] += winAmount;
          pressLosers.forEach(([loserId]) => {
            results[loserId] -= press.unitValue;
          });
          
          details.push(`Press${pressLevelLabel} by ${pressingPlayer?.name} (${segmentLabel} from hole ${press.startHole}): ${winnerName} wins $${winAmount}`);
        } else if (pressWinners.length > 1 || maxPressDots === 0) {
          // Push or tie
          details.push(`Press${pressLevelLabel} by ${pressingPlayer?.name} (${segmentLabel} from hole ${press.startHole}): Push`);
        }
      }
    });
  }

  return { gameId: game.id, playerResults: results, details, holeResults };
};

// --- Wolf Game ---

export const calculateWolf = (round: Round, game: GameSettings): GameResult => {
  const { players, scores, course } = round;
  const unit = game.unitStake;

  if (players.length !== 4) {
    return {
      gameId: game.id,
      playerResults: {},
      details: ["Wolf requires exactly 4 players"],
    };
  }

  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];

  players.forEach((p) => (results[p.id] = 0));

  const wolfData = round.gameData?.[game.id] || {};

  for (let h = 1; h <= course.holes.length; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores) break;

    holeResults[h] = {};
    players.forEach((p) => (holeResults[h][p.id] = 0));

    // Support both direct WolfHoleData and _WOLF_DATA nested format
    const rawWolfData = wolfData[h];
    const holeWolfData = (rawWolfData?.['_WOLF_DATA'] || rawWolfData) as WolfHoleData | undefined;
    if (!holeWolfData?.confirmed) continue;

    // Check if all players have scores
    const allHaveScores = players.every((p) => typeof holeScores[p.id] === "number");
    if (!allHaveScores) continue;

    const wolfId = holeWolfData.wolfId;
    const partnerId = holeWolfData.partnerId;
    const isLoneWolf = holeWolfData.isLoneWolf;
    const isBlindLoneWolf = holeWolfData.isBlindLoneWolf;

    // Determine teams
    const teamWolf = isLoneWolf ? [wolfId] : [wolfId, partnerId!];
    const teamOpponents = players.filter((p) => !teamWolf.includes(p.id)).map((p) => p.id);

    // Calculate best ball net scores for each team
    const getBestBallNet = (teamIds: string[]): number => {
      const nets = teamIds.map((pid) => {
        const gross = holeScores[pid]!;
        const strokes = calculateGameStrokes(round, game, h, pid);
        return gross - strokes;
      });
      return Math.min(...nets);
    };

    const wolfTeamNet = getBestBallNet(teamWolf);
    const opponentTeamNet = getBestBallNet(teamOpponents);

    // Determine points based on game mode
    let wolfWinPoints: number;
    let opponentWinPoints: number;

      if (isBlindLoneWolf) {
        // Blind Lone Wolf: 2x points (+4 from each opponent)
        wolfWinPoints = 4;
        opponentWinPoints = 1;
      } else if (isLoneWolf) {
        // Regular Lone Wolf (+2 from each opponent)
        wolfWinPoints = 2;
        opponentWinPoints = 1;
    } else {
      // 2v2 with partner
      wolfWinPoints = 2;
      opponentWinPoints = 3;
    }

    // Award points based on winner
    if (wolfTeamNet < opponentTeamNet) {
      // Wolf team wins
      if (isLoneWolf) {
        // Lone Wolf wins wolfWinPoints FROM EACH opponent
        const totalWin = wolfWinPoints * teamOpponents.length * unit;
        results[wolfId] += totalWin;
        holeResults[h][wolfId] = totalWin;
        teamOpponents.forEach((pid) => {
          results[pid] -= wolfWinPoints * unit;
          holeResults[h][pid] = -wolfWinPoints * unit;
        });
        details.push(`Hole ${h}: ${players.find((p) => p.id === wolfId)?.name} ${isBlindLoneWolf ? "(Blind) " : ""}Lone Wolf wins +${totalWin}`);
      } else {
        // 2v2 win
        teamWolf.forEach((pid) => {
          results[pid] += wolfWinPoints * unit;
          holeResults[h][pid] = wolfWinPoints * unit;
        });
        teamOpponents.forEach((pid) => {
          results[pid] -= wolfWinPoints * unit;
          holeResults[h][pid] = -wolfWinPoints * unit;
        });
        const wolfName = players.find((p) => p.id === wolfId)?.name;
        const partnerName = players.find((p) => p.id === partnerId)?.name;
        details.push(`Hole ${h}: ${wolfName} + ${partnerName} win +${wolfWinPoints * unit} each`);
      }
    } else if (opponentTeamNet < wolfTeamNet) {
      // Opponents win
      if (isLoneWolf) {
        // Each opponent wins wolfWinPoints from the Wolf
        teamOpponents.forEach((pid) => {
          results[pid] += wolfWinPoints * unit;
          holeResults[h][pid] = wolfWinPoints * unit;
        });
        const totalLoss = wolfWinPoints * teamOpponents.length * unit;
        results[wolfId] -= totalLoss;
        holeResults[h][wolfId] = -totalLoss;
        details.push(`Hole ${h}: ${players.find((p) => p.id === wolfId)?.name} ${isBlindLoneWolf ? "(Blind) " : ""}Lone Wolf loses -${totalLoss}`);
      } else {
        // 2v2 loss - opponents win opponentWinPoints each
        teamOpponents.forEach((pid) => {
          results[pid] += opponentWinPoints * unit;
          holeResults[h][pid] = opponentWinPoints * unit;
        });
        teamWolf.forEach((pid) => {
          const loss = (opponentWinPoints * teamOpponents.length * unit) / teamWolf.length;
          results[pid] -= loss;
          holeResults[h][pid] = -loss;
        });
        details.push(`Hole ${h}: Opponents beat Wolf team`);
      }
    } else {
      // Tie - push
      details.push(`Hole ${h}: Push (tie)`);
    }
  }

  return { gameId: game.id, playerResults: results, details, holeResults };
};

// --- Nine Points Game ---

export const calculateNinePoints = (round: Round, game: GameSettings): GameResult => {
  const { players, scores, course } = round;
  const unit = game.unitStake;

  if (players.length !== 3) {
    return {
      gameId: game.id,
      playerResults: {},
      details: ["Nine Points requires exactly 3 players"],
    };
  }

  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];

  players.forEach((p) => (results[p.id] = 0));

  for (let h = 1; h <= course.holes.length; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores) break;

    holeResults[h] = {};
    players.forEach((p) => (holeResults[h][p.id] = 0));

    // Check if all players have scores
    const allHaveScores = players.every((p) => typeof holeScores[p.id] === "number");
    if (!allHaveScores) continue;

    // Calculate net scores for all players
    const netScores = players.map((p) => {
      const gross = holeScores[p.id]!;
      const strokes = calculateGameStrokes(round, game, h, p.id);
      return {
        playerId: p.id,
        name: p.name,
        net: gross - strokes,
      };
    }).sort((a, b) => a.net - b.net);

    // Distribute 9 points based on rankings
    const [first, second, third] = netScores;
    let points: { [id: string]: number } = {};

    if (first.net === second.net && second.net === third.net) {
      // Three-way tie: 3-3-3
      points = { [first.playerId]: 3, [second.playerId]: 3, [third.playerId]: 3 };
      details.push(`Hole ${h}: Three-way tie - 3 pts each`);
    } else if (first.net === second.net) {
      // Tie for 1st: 4-4-1
      points = { [first.playerId]: 4, [second.playerId]: 4, [third.playerId]: 1 };
      details.push(`Hole ${h}: ${first.name} & ${second.name} tie for low - 4 pts each, ${third.name} gets 1`);
    } else if (second.net === third.net) {
      // Tie for 3rd: 5-2-2
      points = { [first.playerId]: 5, [second.playerId]: 2, [third.playerId]: 2 };
      details.push(`Hole ${h}: ${first.name} wins 5 pts, ${second.name} & ${third.name} tie - 2 pts each`);
    } else {
      // No ties: 5-3-1
      points = { [first.playerId]: 5, [second.playerId]: 3, [third.playerId]: 1 };
      details.push(`Hole ${h}: ${first.name} 5 pts, ${second.name} 3 pts, ${third.name} 1 pt`);
    }

    // Apply points and convert to money
    Object.entries(points).forEach(([pid, pts]) => {
      const money = pts * unit;
      results[pid] += money;
      holeResults[h][pid] = money;
    });
  }

  // Nine Points is a "pot" game - subtract average to make it zero-sum
  const totalAwarded = Object.values(results).reduce((sum, val) => sum + val, 0);
  const perPlayerShare = totalAwarded / players.length;
  players.forEach((p) => {
    results[p.id] -= perPlayerShare;
  });

  return { gameId: game.id, playerResults: results, details, holeResults };
};

// --- Aggregation Utilities ---

export const calculatePerGameTotals = (round: Round): {
  gameId: string;
  gameName: string;
  gameType: GameType;
  playerResults: { [playerId: string]: number };
}[] => {
  const results: {
    gameId: string;
    gameName: string;
    gameType: GameType;
    playerResults: { [playerId: string]: number };
  }[] = [];

  round.games.forEach((game) => {
    let result: GameResult;

    switch (game.type) {
      case GameType.SKINS:
        result = calculateSkins(round, game);
        break;
      case GameType.NASSAU:
        result = calculateNassau(round, game);
        break;
      case GameType.OPEN_BETTING:
        result = calculateOpenBetting(round, game);
        break;
      case GameType.BANKER:
      case GameType.BLOODY_BANKER:
        result = calculateBanker(round, game);
        break;
      case GameType.FBO:
        result = calculateFBO(round, game);
        break;
      case GameType.STOCKTON_6:
        result = calculateStockton6(round, game);
        break;
      case GameType.WOLF:
        result = calculateWolf(round, game);
        break;
      case GameType.NINE_POINTS:
        result = calculateNinePoints(round, game);
        break;
      case GameType.SIXES:
        result = calculateSixes(round, game);
        break;
      default:
        return;
    }

    results.push({
      gameId: game.id,
      gameName: game.name,
      gameType: game.type,
      playerResults: result.playerResults,
    });
  });

  return results;
};

export const calculateRoundTotals = (round: Round): { [playerId: string]: number } => {
  // Check for saved final adjustments first (user overrides)
  const savedAdjustments = round.gameData?._META?.[0]?._FINAL_ADJUSTMENTS;
  if (savedAdjustments && Object.keys(savedAdjustments).length > 0) {
    return savedAdjustments;
  }

  const totals: { [playerId: string]: number } = {};
  round.players.forEach((p) => (totals[p.id] = 0));

  const perGameResults = calculatePerGameTotals(round);
  perGameResults.forEach((gameResult) => {
    Object.entries(gameResult.playerResults).forEach(([playerId, amount]) => {
      totals[playerId] = (totals[playerId] || 0) + amount;
    });
  });

  return totals;
};

export const calculateAggregatedHolePnL = (round: Round): Record<number, Record<string, number>> => {
  const holePnL: Record<number, Record<string, number>> = {};

  round.course.holes.forEach((hole) => {
    const holeNumber = hole.number;
    holePnL[holeNumber] = {};

    // Initialize all players to $0 for this hole
    round.players.forEach((p) => {
      holePnL[holeNumber][p.id] = 0;
    });

    // Process Banker and Bloody Banker games
    round.games
      .filter((g) => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER)
      .forEach((game) => {
        const holeData = round.gameData?.[game.id]?.[holeNumber] || {};
        const bankerId = holeData["_META_BANKER_ID"];

        if (!bankerId) return; // No banker selected for this hole

        const banker = round.players.find((p) => p.id === bankerId);
        if (!banker) return;

        const bankerScore = round.scores[holeNumber]?.[bankerId];
        if (bankerScore === undefined || bankerScore === null) return;

        const bankerMult = holeData["_META_BANKER_MULT"] || 1;

        // Process each opponent
        round.players
          .filter((p) => p.id !== bankerId)
          .forEach((player) => {
            const playerScore = round.scores[holeNumber]?.[player.id];
            if (playerScore === undefined || playerScore === null) return;

            // Calculate strokes for both player and banker in this matchup
            const matchupStrokes = calculateBankerMatchupStrokes(
              player.courseHandicap,
              banker.courseHandicap,
              hole.handicapIndex,
            );
            let playerStrokes = matchupStrokes.playerStrokes;
            let bankerStrokes = matchupStrokes.bankerStrokes;

            // Check for manual override
            const manualStrokes = round.gameData?.["MANUAL_STROKES"]?.[holeNumber]?.[player.id];
            if (manualStrokes !== undefined && manualStrokes !== null) {
              playerStrokes = manualStrokes;
              bankerStrokes = 0; // Manual override only affects player strokes
            }

            const playerNetScore = playerScore - playerStrokes;
            const bankerNetScore = bankerScore - bankerStrokes;

            // Calculate bet amount with score-based multipliers
            let playerMult = holeData[player.id] || 1;
            let effectiveBankerMult = bankerMult;
            
            // Get birdie/eagle multipliers from game config (support new and legacy format)
            const birdieMultiplier = game.config?.birdieMultiplier ?? (game.config?.birdieTriple ? 3 : 1);
            const eagleMultiplier = game.config?.eagleMultiplier ?? (game.config?.eagleQuintuple ? 5 : 1);
            
            // Apply score-based multipliers for banker
            const bankerToPar = bankerScore - hole.par;
            if (eagleMultiplier > 1 && bankerToPar <= -2) {
              effectiveBankerMult *= eagleMultiplier;
            } else if (birdieMultiplier > 1 && bankerToPar === -1) {
              effectiveBankerMult *= birdieMultiplier;
            }
            
            // Apply score-based multipliers for player
            const playerToPar = playerScore - hole.par;
            if (eagleMultiplier > 1 && playerToPar <= -2) {
              playerMult *= eagleMultiplier;
            } else if (birdieMultiplier > 1 && playerToPar === -1) {
              playerMult *= birdieMultiplier;
            }
            
            // For Bloody Banker on holes 16, 17, 18: custom stake becomes the BASE BET
            // Formula: Base Bet × Banker Multiplier (Double All) × Player Multiplier = Final Bet
            let betAmount: number;
            if (game.type === GameType.BLOODY_BANKER && holeNumber >= 16 && holeNumber <= 18) {
              const customStake = holeData[`_STAKE_${player.id}`];
              if (customStake !== undefined && customStake > 0) {
                // Custom stake is the new base bet
                // Multiply by effectiveBankerMult (Double All, etc.) AND playerMult (player's double + birdie/eagle)
                betAmount = customStake * effectiveBankerMult * playerMult;
              } else {
                // No custom stake set, use default calculation
                betAmount = game.unitStake * effectiveBankerMult * playerMult;
              }
            } else {
              betAmount = game.unitStake * effectiveBankerMult * playerMult;
            }

            // Determine winner and update P&L
            if (playerNetScore < bankerNetScore) {
              // Player wins
              holePnL[holeNumber][player.id] += betAmount;
              holePnL[holeNumber][bankerId] -= betAmount;
            } else if (playerNetScore > bankerNetScore) {
              // Banker wins
              holePnL[holeNumber][player.id] -= betAmount;
              holePnL[holeNumber][bankerId] += betAmount;
            }
            // Tie = no money changes hands
          });
      });

    // Process Open Betting games
    round.games
      .filter((g) => g.type === GameType.OPEN_BETTING)
      .forEach((game) => {
        const holeData = round.gameData?.[game.id]?.[holeNumber] || {};
        round.players.forEach((p) => {
          const betValue = holeData[p.id] || 0;
          holePnL[holeNumber][p.id] += betValue;
        });
      });

    // Process Skins games
    round.games
      .filter((g) => g.type === GameType.SKINS)
      .forEach((game) => {
        const result = calculateSkins(round, game);
        if (result.holeResults?.[holeNumber]) {
          Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
            holePnL[holeNumber][playerId] += amount;
          });
        }
      });

    // Process Nassau games
    round.games
      .filter((g) => g.type === GameType.NASSAU)
      .forEach((game) => {
        const result = calculateNassau(round, game);
        if (result.holeResults?.[holeNumber]) {
          Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
            holePnL[holeNumber][playerId] += amount;
          });
        }
      });

    // Process Stockton 6's games - attribute P&L to stretch end holes (6, 12, 18)
    round.games
      .filter((g) => g.type === GameType.STOCKTON_6)
      .forEach((game) => {
        const result = calculateStockton6(round, game);
        if (result.holeResults?.[holeNumber]) {
          Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
            holePnL[holeNumber][playerId] += amount;
          });
        }
      });

    // Process Wolf games
    round.games
      .filter((g) => g.type === GameType.WOLF)
      .forEach((game) => {
        const result = calculateWolf(round, game);
        if (result.holeResults?.[holeNumber]) {
          Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
            holePnL[holeNumber][playerId] += amount;
          });
        }
      });

    // Process Nine Points games
    round.games
      .filter((g) => g.type === GameType.NINE_POINTS)
      .forEach((game) => {
        const result = calculateNinePoints(round, game);
        if (result.holeResults?.[holeNumber]) {
          Object.entries(result.holeResults[holeNumber]).forEach(([playerId, amount]) => {
            holePnL[holeNumber][playerId] += amount;
          });
        }
      });
  });

  return holePnL;
};

export const getScoreLabel = (gross: number, par: number): string => {
  const diff = gross - par;
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double Bogey";
  if (diff === 3) return "Triple Bogey";
  return `+${diff}`;
};

export const formatMoney = (amount: number): string => {
  if (amount === 0) return "$0";
  const prefix = amount > 0 ? "+" : "-";
  return `${prefix}$${Math.abs(amount)}`;
};

// Calculate P&L for a specific Bloody Banker game up to a given hole
// Used for determining who is "down the most" for bet-setting privileges on holes 16-18
export const calculateBloodyBankerPnL = (
  round: Round,
  game: GameSettings,
  upToHole: number
): { [playerId: string]: number } => {
  const { players, scores, course } = round;
  const unit = game.unitStake;
  const birdieMultiplier = game.config.birdieMultiplier ?? (game.config.birdieTriple ? 3 : 1);
  const eagleMultiplier = game.config.eagleMultiplier ?? (game.config.eagleQuintuple ? 5 : 1);

  const results: { [id: string]: number } = {};
  players.forEach((p) => (results[p.id] = 0));

  const bankerData = round.gameData?.[game.id] || {};

  for (let h = 1; h <= upToHole; h++) {
    const holeData = course.holes.find((hole) => hole.number === h);
    if (!holeData) continue;

    const holeScores = scores[h];
    if (!holeScores) continue;

    // Check if all players have scores for this hole
    const allHaveScores = players.every(p => typeof holeScores[p.id] === 'number');
    if (!allHaveScores) continue;

    const holeBankerData = bankerData[h];
    if (!holeBankerData) continue;

    const bankerId = holeBankerData["_META_BANKER_ID"] || holeBankerData.bankerId;
    if (!bankerId) continue;

    const banker = players.find((p) => p.id === bankerId);
    if (!banker) continue;

    const bankerGross = holeScores[bankerId];
    if (typeof bankerGross !== "number") continue;

    let bankerBaseMultiplier = holeBankerData["_META_BANKER_MULT"] || holeBankerData.bankerMultiplier || 1;

    const bankerToPar = bankerGross - holeData.par;
    if (eagleMultiplier > 1 && bankerToPar <= -2) {
      bankerBaseMultiplier *= eagleMultiplier;
    } else if (birdieMultiplier > 1 && bankerToPar === -1) {
      bankerBaseMultiplier *= birdieMultiplier;
    }

    players.forEach((p) => {
      if (p.id === bankerId) return;

      const playerGross = holeScores[p.id];
      if (typeof playerGross !== "number") return;

      const playerManualStrokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p.id];
      let playerStrokesReceived: number;
      let bankerStrokesReceived: number;

      if (playerManualStrokes !== undefined && playerManualStrokes !== null) {
        playerStrokesReceived = playerManualStrokes;
        bankerStrokesReceived = 0;
      } else {
        const matchupStrokes = calculateBankerMatchupStrokes(
          p.courseHandicap,
          banker.courseHandicap,
          holeData.handicapIndex,
        );
        playerStrokesReceived = matchupStrokes.playerStrokes;
        bankerStrokesReceived = matchupStrokes.bankerStrokes;
      }

      const playerNet = playerGross - playerStrokesReceived;
      const bankerNet = bankerGross - bankerStrokesReceived;

      let playerMultiplier = holeBankerData[p.id] || holeBankerData.playerMultipliers?.[p.id] || 1;
      if (typeof playerMultiplier !== "number") playerMultiplier = 1;

      const playerToPar = playerGross - holeData.par;
      if (eagleMultiplier > 1 && playerToPar <= -2) {
        playerMultiplier *= eagleMultiplier;
      } else if (birdieMultiplier > 1 && playerToPar === -1) {
        playerMultiplier *= birdieMultiplier;
      }

      const effectiveMultiplier = bankerBaseMultiplier * playerMultiplier;
      const payout = unit * effectiveMultiplier;

      if (bankerNet < playerNet) {
        results[bankerId] += payout;
        results[p.id] -= payout;
      } else if (playerNet < bankerNet) {
        results[p.id] += payout;
        results[bankerId] -= payout;
      }
    });
  }

  return results;
};

// Check if all players have completed a hole
export const isHoleComplete = (round: Round, holeNumber: number): boolean => {
  const holeScores = round.scores[holeNumber];
  if (!holeScores) return false;
  return round.players.every(p => typeof holeScores[p.id] === 'number');
};

// Check if first N holes are complete (all players have scores)
export const areHolesComplete = (round: Round, throughHole: number): boolean => {
  for (let h = 1; h <= throughHole; h++) {
    if (!isHoleComplete(round, h)) return false;
  }
  return true;
};
