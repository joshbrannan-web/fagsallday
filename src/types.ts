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
  FBO = 'FBO',
  STOCKTON_6 = 'STOCKTON_6'
}

// Stockton 6's types
export type DotType = 'BIRDIE' | 'GREENIE' | 'DOT';

// New structure for player dots on a hole
export interface PlayerHoleDots {
  birdie?: boolean;
  greenie?: boolean;
  dotMultiplier?: number; // 2, 3, 4, or 5 (undefined = no dot)
}

export interface Stockton6TeamAssignment {
  teamA: string[]; // Player IDs (exactly 2)
  teamB: string[]; // Player IDs (exactly 2)
  unitValue: number; // $ per unit (default 5)
  dotValue: number; // $ per dot (default 2)
  locked: boolean;
}

export interface Stockton6PressState {
  startHole: number; // Hole where press started (1-6 within stretch)
  teamAUp: number; // Stroke differential (positive = Team A winning)
}

export interface Stockton6BallState {
  front: {
    teamAUp: number;
    presses: Stockton6PressState[];
  };
  back: {
    teamAUp: number;
    presses: Stockton6PressState[];
  };
  overall: {
    teamAUp: number;
  };
}

export interface Stockton6StretchState {
  oneBall: Stockton6BallState;
  twoBall: Stockton6BallState;
  greenieCarryover?: number; // Multiplier for next greenie (1 = normal, 2+ = carried over)
  dots: {
    [playerId: string]: PlayerHoleDots;
  }[];
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
    // Stockton 6's config
    stockton6?: {
      dotValue: number; // Default $2 per dot
    };
    // Universal handicap configuration (not for Stockton 6's - it has its own logic)
    useHandicaps?: boolean; // true = use handicaps, false = gross scores only
    handicapMode?: 'absolute' | 'relative'; // 'absolute' = Stockton 6 style, 'relative' = Banker style (lowest HCP = 0)
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
