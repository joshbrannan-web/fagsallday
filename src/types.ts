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
  STOCKTON_6 = 'STOCKTON_6',
  SIXES = 'SIXES',
  TEAM_BANKER = 'TEAM_BANKER'
}

// Wolf game types
export interface WolfHoleData {
  wolfId: string;           // Player ID of the Wolf this hole
  partnerId?: string;       // Partner ID if selected, null for Lone Wolf
  isLoneWolf: boolean;      // true if Wolf is playing alone
  isBlindLoneWolf: boolean; // true if declared before tee shots (2x points)
  confirmed: boolean;       // true once decision is locked in
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

// FBO Press State (stored in gameData under _META_PRESSES)
export interface FBOPressState {
  playerId: string;        // Who triggered the press
  segment: 'front' | 'back' | 'overall';
  startHole: number;       // Hole where press was triggered
  unitValue: number;       // Amount (same as base unit)
  settled: boolean;        // Whether press has been settled
  pressLevel: number;      // 1 = first press, 2 = double press, etc.
  opponentId?: string;     // For head-to-head mode: who is the press against
  result?: {               // Only populated when settled
    winnerId: string | null;  // null = push
    amount: number;
  };
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
    birdieMultiplier?: number; // For Banker: 1 = none, 2 = double, 3 = triple
    eagleMultiplier?: number; // For Banker: 1 = none, 3 = triple, 5 = quintuple
    fboPlayers?: string[]; // For FBO: player IDs participating in this game
    // FBO game config
    fbo?: {
      allowPresses: boolean; // Enable/disable press option (double-or-nothing when dormie)
      handicapMode?: 'absolute' | 'relative'; // Stroke calculation mode
      gameMode?: 'together' | 'headToHead'; // All together or head-to-head matchups
      headToHeadMatchups?: Array<{
        player1Id: string;
        player2Id: string;
        unitValue: number;
      }>;
    };
    // Stockton 6's config
    stockton6?: {
      dotValue: number; // Default $2 per dot
    };
    // Wolf game config
    wolf?: {
      teesFirst: boolean; // true = Wolf tees first, false = Wolf tees last
    };
    // Team Banker game config
    teamBanker?: {
      mode: 'eighteen' | 'sixes' | 'threes'; // team rotation frequency
      useSecondBallTiebreaker: boolean;
    };
    // 6's game config
    sixes?: {
      useSecondBallTiebreaker: boolean; // Use 2nd ball to break 1st ball ties
      allowPresses?: boolean; // Enable/disable press option (double-or-nothing when dormie)
      mode?: 'sixes' | 'threes'; // 'sixes' = 3 stretches of 6 holes, 'threes' = 6 stretches of 3 holes
    };
    // Universal handicap configuration (not for Stockton 6's - it has its own logic)
    useHandicaps?: boolean; // true = use handicaps, false = gross scores only
    handicapMode?: 'absolute' | 'relative'; // 'absolute' = Stockton 6 style, 'relative' = Banker style (lowest HCP = 0)
  };
}

// 6's Team Assignment
export interface SixesTeamAssignment {
  teamA: string[]; // Player IDs (exactly 2)
  teamB: string[]; // Player IDs (exactly 2)
  unitValue: number; // $ per player bet
  useHandicaps: boolean;
  useSecondBallTiebreaker: boolean;
  handicapMode: 'absolute' | 'relative'; // Which stroke calculation mode to use
  allowPresses: boolean; // Enable/disable press option
  mode: 'sixes' | 'threes'; // Game mode
  locked: boolean;
}

// 6's Press State (stored in gameData under _META_PRESSES at stretch start hole)
export interface SixesPressState {
  triggeredBy: string;       // Player ID who triggered the press (for their team)
  teamDormie: 'A' | 'B';     // Which team is dormie/pressing
  stretch: 1 | 2 | 3 | 4 | 5 | 6; // Which stretch (6 for 3's mode)
  startHole: number;         // Hole where press was triggered (1-18)
  unitValue: number;         // Amount (same as base unit)
  settled: boolean;          // Whether press has been settled
  result?: {                 // Only populated when settled
    winningTeam: 'A' | 'B' | null;  // null = push
    amount: number;
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
  status: 'SETUP' | 'ACTIVE' | 'COMPLETE' | 'LOCKED';
  startTime: number;
  isFavorite?: boolean;
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
