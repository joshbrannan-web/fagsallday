export interface Hole {
  number: number;
  par: number;
  handicapIndex: number; // Stroke index (1-18 difficulty)
  yardage: number;
}

export interface Course {
  id: string;
  name: string;
  location: string;
  holes: Hole[];
}

export interface Player {
  id: string;
  name: string;
  handicapIndex: number; // The generic index (e.g., 12.4)
  courseHandicap: number; // Calculated integer strokes for this course
  tee: string;
}

export enum GameType {
  STROKE = 'STROKE',
  SKINS = 'SKINS',
  NASSAU = 'NASSAU',
  MATCH = 'MATCH',
  WOLF = 'WOLF',
  NINE_POINTS = 'NINE_POINTS',
  BINGO_BANGO_BONGO = 'BINGO_BANGO_BONGO',
  OPEN_BETTING = 'OPEN_BETTING',
  BANKER = 'BANKER',
  BLOODY_BANKER = 'BLOODY_BANKER',
  FBO = 'FBO'
}

export interface GameSettings {
  id: string;
  type: GameType;
  name: string;
  unitStake: number; // e.g., $5
  config: {
    carryovers?: boolean; // For skins
    presses?: boolean; // For Nassau
    handicapPct?: number; // e.g., 100% or 80%
    birdieTriple?: boolean; // For Banker: 3x payout on Gross Birdie (legacy)
    eagleQuintuple?: boolean; // For Banker: 5x payout on Gross Eagle (legacy)
    birdieMultiplier?: number; // For Banker: 1 = none, 3 = triple
    eagleMultiplier?: number; // For Banker: 1 = none, 3 = triple, 5 = quintuple
    fboPlayers?: string[]; // For FBO: player IDs participating in this game
  };
}

// Stores the raw strokes entered. Key is playerId.
export interface HoleScores {
  [playerId: string]: number | null;
}

// Stores arbitrary game data.
// Structure: gameId -> holeNumber -> ANY (allows for scalars or objects like { bankerId: '...', multipliers: {...} })
export interface GameData {
  [gameId: string]: {
    [holeNumber: number]: any
  };
}

export interface Round {
  id: string;
  course: Course;
  players: Player[];
  games: GameSettings[];
  scores: { [holeNumber: number]: HoleScores };
  gameData: GameData;
  status: 'SETUP' | 'ACTIVE' | 'COMPLETE';
  startTime: number;
}

export interface CalculationResult {
  gross: number;
  net: number;
  toParGross: number;
  toParNet: number;
}

export interface GameResult {
  gameId: string;
  playerResults: { [playerId: string]: number }; // Amount won/lost
  details: string[]; // Log of what happened (e.g., "Hole 1: John wins skin")
  holeResults?: { [holeNumber: number]: { [playerId: string]: number } }; // Per-hole breakdown
}

export interface AiValidationResult {
  isValid: boolean;
  message?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface GameLibraryItem {
  type: GameType;
  name: string;
  description: string;
  icon: string;
  defaultUnitStake: number;
  minPlayers: number;
  maxPlayers: number;
  config: GameSettings['config'];
}
