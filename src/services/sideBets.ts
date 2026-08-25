import { GameSettings, Player, Round, Course, GameType } from '@/types';
import {
  calculateCourseHandicap,
  calculateFBOHoleWinners,
  calculateFBOMatchupHoleWinner,
  calculateFBOTeamHoleWinner,
  calculatePerGameTotals,
  calculateSettlement,
} from '@/services/gameEngine';

export interface SideBetPlayerInput {
  id: string;                 // tournament_player id
  displayName: string;
  handicapIndex: number;      // effective (override ?? index)
}

export interface SideBetGameResult {
  gameId: string;
  gameName: string;
  gameType: GameType;
  playerResults: Record<string, number>;
}

export interface SideBetResults {
  holesCounted: number[];
  perGame: SideBetGameResult[];
  totals: { playerId: string; name: string; amount: number }[];
  settlement: { from: string; to: string; amount: number }[];
}

const normalizeSideBetGames = (games: GameSettings[], players: Player[]): GameSettings[] => {
  const playerIds = players.map((p) => p.id);

  return games.map((game) => {
    const gamePlayers = game.config.gamePlayers?.length ? game.config.gamePlayers : playerIds;

    if (game.type !== GameType.FBO) {
      return {
        ...game,
        config: {
          ...game.config,
          gamePlayers,
        },
      };
    }

    const fboPlayers = game.config.fboPlayers?.length ? game.config.fboPlayers : gamePlayers;

    return {
      ...game,
      config: {
        ...game.config,
        gamePlayers,
        fboPlayers,
        fbo: {
          allowPresses: game.config.fbo?.allowPresses ?? false,
          ...game.config.fbo,
        },
      },
    };
  });
};

const validateFBOSetup = (round: Round, game: GameSettings) => {
  const mode = game.config.fbo?.gameMode || 'together';
  const playerIds = game.config.fboPlayers?.length ? game.config.fboPlayers : round.players.map((p) => p.id);

  if (playerIds.length < 2) {
    throw new Error('FBO requires at least 2 players');
  }

  if (mode === 'headToHead') {
    const matchups = game.config.fbo?.headToHeadMatchups || [];
    if (matchups.length === 0) {
      throw new Error('FBO Head to Head needs at least one matchup selected');
    }
  }

  if (mode === 'teams') {
    const teams = game.config.fbo?.teams;
    if (!teams || teams.teamA.length !== 2 || teams.teamB.length !== 2) {
      throw new Error('FBO Teams needs two teams with 2 players each');
    }
  }
};

const hydrateFBOGameData = (round: Round, game: GameSettings, holesCounted: number[]) => {
  validateFBOSetup(round, game);

  const mode = game.config.fbo?.gameMode || 'together';
  const existingGameData = round.gameData[game.id] || {};
  round.gameData[game.id] = existingGameData;

  holesCounted.forEach((holeNumber) => {
    const existingHoleData = existingGameData[holeNumber] || {};

    if (mode === 'teams') {
      existingGameData[holeNumber] = {
        ...existingHoleData,
        teamDot: calculateFBOTeamHoleWinner(round, game, holeNumber),
      };
      return;
    }

    if (mode === 'headToHead') {
      const matchupDots: Record<string, string | null> = {};
      (game.config.fbo?.headToHeadMatchups || []).forEach((matchup) => {
        const matchupKey = `${matchup.player1Id}_${matchup.player2Id}`;
        matchupDots[matchupKey] = calculateFBOMatchupHoleWinner(
          round,
          game,
          holeNumber,
          matchup.player1Id,
          matchup.player2Id,
        );
      });
      existingGameData[holeNumber] = {
        ...existingHoleData,
        matchupDots,
      };
      return;
    }

    existingGameData[holeNumber] = {
      ...existingHoleData,
      dots: calculateFBOHoleWinners(round, game, holeNumber),
    };
  });
};

const hydrateSideBetGameData = (round: Round, holesCounted: number[]) => {
  round.games.forEach((game) => {
    if (game.type === GameType.FBO) {
      hydrateFBOGameData(round, game, holesCounted);
    }
  });
};

/** Convert raw tournament data into the shape the shared game engine expects. */
export const buildSideBetRound = (
  courseData: Course,
  playersInput: SideBetPlayerInput[],
  games: GameSettings[],
  holeScores: { tournament_player_id: string; hole_number: number; gross_score: number | null }[],
): { round: Round; holesCounted: number[] } => {
  const holes = courseData?.holes || [];
  const totalPar = holes.reduce((s, h) => s + (h.par || 0), 0);

  const players: Player[] = playersInput.map((p) => ({
    id: p.id,
    name: p.displayName,
    handicapIndex: p.handicapIndex,
    courseHandicap: calculateCourseHandicap(p.handicapIndex, totalPar),
    tee: 'White',
  }));

  const selectedIds = new Set(playersInput.map((p) => p.id));

  // Group raw scores by hole for the selected players only
  const byHole: Record<number, Record<string, number>> = {};
  holeScores.forEach((row) => {
    if (!selectedIds.has(row.tournament_player_id)) return;
    if (row.gross_score == null) return;
    if (!byHole[row.hole_number]) byHole[row.hole_number] = {};
    byHole[row.hole_number][row.tournament_player_id] = row.gross_score;
  });

  // Only keep holes where every selected player has a score
  const scores: Round['scores'] = {};
  const holesCounted: number[] = [];
  holes.forEach((h) => {
    const entry = byHole[h.number];
    if (entry && playersInput.every((p) => entry[p.id] != null)) {
      scores[h.number] = { ...entry };
      holesCounted.push(h.number);
    }
  });

  const normalizedGames = normalizeSideBetGames(games, players);

  const round: Round = {
    id: `sidebet-${Date.now()}`,
    course: courseData,
    players,
    games: normalizedGames,
    scores,
    gameData: {},
    status: 'ACTIVE',
    startTime: Date.now(),
    startHole: 1,
  };

  hydrateSideBetGameData(round, holesCounted);

  return { round, holesCounted };
};

export const calculateSideBets = (
  courseData: Course,
  playersInput: SideBetPlayerInput[],
  games: GameSettings[],
  holeScores: { tournament_player_id: string; hole_number: number; gross_score: number | null }[],
): SideBetResults => {
  const { round, holesCounted } = buildSideBetRound(courseData, playersInput, games, holeScores);

  const perGame = calculatePerGameTotals(round) as SideBetGameResult[];

  const totals = playersInput.map((p) => ({
    playerId: p.id,
    name: p.displayName,
    amount:
      Math.round(
        perGame.reduce((sum, g) => sum + (g.playerResults?.[p.id] || 0), 0) * 100,
      ) / 100,
  }));

  const settlement = calculateSettlement(totals.map((t) => ({ name: t.name, amount: t.amount })));

  return { holesCounted, perGame, totals, settlement };
};
