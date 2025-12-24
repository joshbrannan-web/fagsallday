import { Course, GameSettings, GameType, Player, Round, GameResult } from "../types";

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

// Calculate strokes relative to banker for head-to-head Banker game
// A player receives a stroke if:
// 1. Player has HIGHER handicap than banker (lower handicap players don't get strokes)
// 2. (Player Handicap - Banker Handicap) >= Hole Handicap Index
// Returns 1 if player receives stroke, 0 otherwise
export const calculateBankerStrokeReceived = (
  playerHandicap: number,
  bankerHandicap: number,
  holeHandicapIndex: number,
): number => {
  // Only higher handicap players can receive strokes
  if (playerHandicap <= bankerHandicap) return 0;
  
  const handicapDifference = playerHandicap - bankerHandicap;
  // Player receives a stroke if their handicap advantage >= hole handicap index
  return handicapDifference >= holeHandicapIndex ? 1 : 0;
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

    // Calculate net scores - only apply manual strokes, no automatic calculation
    const nets = activePlayers.map((p) => {
      const gross = holeScores[p.id]!;
      const manualStrokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p.id];
      // Only apply strokes if manually set, otherwise use gross score
      const effectiveStrokes = manualStrokes !== undefined && manualStrokes !== null ? manualStrokes : 0;
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

    const m1Strokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p1.id];
    const m2Strokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p2.id];

    // Only apply strokes if manually set, otherwise use gross score
    const effectiveStrokes1 = m1Strokes !== undefined && m1Strokes !== null ? m1Strokes : 0;
    const effectiveStrokes2 = m2Strokes !== undefined && m2Strokes !== null ? m2Strokes : 0;
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
  const birdieTriple = game.config.birdieTriple ?? false;
  const eagleQuintuple = game.config.eagleQuintuple ?? false;

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

    // Banker's net is just their gross (banker doesn't get strokes against themselves)
    const bankerNet = bankerGross;

    // Get base multiplier for banker (support both formats)
    let bankerBaseMultiplier = holeBankerData["_META_BANKER_MULT"] || holeBankerData.bankerMultiplier || 1;

    // Apply score-based multipliers
    const bankerToPar = bankerGross - holeData.par;
    if (eagleQuintuple && bankerToPar <= -2) {
      bankerBaseMultiplier *= 5;
    } else if (birdieTriple && bankerToPar === -1) {
      bankerBaseMultiplier *= 3;
    }

    // Calculate against each non-banker player
    players.forEach((p) => {
      if (p.id === bankerId) return;

      const playerGross = holeScores[p.id];
      if (typeof playerGross !== "number") return;

      // Check for manual stroke override first
      const playerManualStrokes = round.gameData?.["MANUAL_STROKES"]?.[h]?.[p.id];

      // Player receives a stroke if (Player Handicap - Banker Handicap) >= Hole Handicap Index
      let playerStrokesReceived: number;
      if (playerManualStrokes !== undefined && playerManualStrokes !== null) {
        // Use manual override if set
        playerStrokesReceived = playerManualStrokes;
      } else {
        // Calculate based on handicap difference vs hole handicap index
        playerStrokesReceived = calculateBankerStrokeReceived(
          p.courseHandicap,
          banker.courseHandicap,
          holeData.handicapIndex,
        );
      }

      const playerNet = playerGross - playerStrokesReceived;

      // Get player-specific multiplier (stored directly under player ID in new format)
      let playerMultiplier = holeBankerData[p.id] || holeBankerData.playerMultipliers?.[p.id] || 1;
      // Filter out non-numeric values (like _META keys stored as strings)
      if (typeof playerMultiplier !== "number") playerMultiplier = 1;

      // Apply score-based multipliers for player too
      const playerToPar = playerGross - holeData.par;
      if (eagleQuintuple && playerToPar <= -2) {
        playerMultiplier *= 5;
      } else if (birdieTriple && playerToPar === -1) {
        playerMultiplier *= 3;
      }

      const effectiveMultiplier = bankerBaseMultiplier * playerMultiplier;
      const payout = unit * effectiveMultiplier;

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

// --- Aggregation Utilities ---

export const calculateRoundTotals = (round: Round): { [playerId: string]: number } => {
  const totals: { [playerId: string]: number } = {};
  round.players.forEach((p) => (totals[p.id] = 0));

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
        result = calculateBanker(round, game);
        break;
      default:
        return;
    }

    Object.entries(result.playerResults).forEach(([playerId, amount]) => {
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

    // Process Banker games
    round.games
      .filter((g) => g.type === GameType.BANKER)
      .forEach((game) => {
        const holeData = round.gameData?.[game.id]?.[holeNumber] || {};
        const bankerId = holeData["_META_BANKER_ID"];

        if (!bankerId) return; // No banker selected for this hole

        const banker = round.players.find((p) => p.id === bankerId);
        if (!banker) return;

        const bankerScore = round.scores[holeNumber]?.[bankerId];
        if (bankerScore === undefined || bankerScore === null) return;

        const bankerMult = holeData["_META_BANKER_MULT"] || 1;

        // Banker's strokes are 0 vs themselves
        const bankerStrokes = 0;
        const bankerNetScore = bankerScore - bankerStrokes;

        // Process each opponent
        round.players
          .filter((p) => p.id !== bankerId)
          .forEach((player) => {
            const playerScore = round.scores[holeNumber]?.[player.id];
            if (playerScore === undefined || playerScore === null) return;

            // Calculate if player receives stroke using Banker rule
            let playerStrokes = calculateBankerStrokeReceived(
              player.courseHandicap,
              banker.courseHandicap,
              hole.handicapIndex,
            );

            // Check for manual override
            const manualStrokes = round.gameData?.["MANUAL_STROKES"]?.[holeNumber]?.[player.id];
            if (manualStrokes !== undefined && manualStrokes !== null) {
              playerStrokes = manualStrokes;
            }

            const playerNetScore = playerScore - playerStrokes;

            // Calculate bet amount
            const playerMult = holeData[player.id] || 1;
            const betAmount = game.unitStake * playerMult * bankerMult;

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
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}$${Math.abs(amount)}`;
};
