import { GameSettings, Player, Round, Course, GameType } from '@/types';
import { calculateCourseHandicap, calculatePerGameTotals, calculateSettlement } from '@/services/gameEngine';

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

  const round: Round = {
    id: `sidebet-${Date.now()}`,
    course: courseData,
    players,
    games,
    scores,
    gameData: {},
    status: 'ACTIVE',
    startTime: Date.now(),
    startHole: 1,
  };

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
