// Tournament Scoring Engine — pure functions for tournament game calculations

export type TournamentGameType =
  | 'stroke_gross'
  | 'stroke_net'
  | 'stableford'
  | 'modified_stableford'
  | 'team_stroke_gross'
  | 'team_stroke_net'
  | 'team_best_ball';

export interface ModifiedStablefordValues {
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  double_bogey: number;
}

export const DEFAULT_STABLEFORD_VALUES: Readonly<Record<string, number>> = {
  albatross: 5,
  eagle: 4,
  birdie: 3,
  par: 2,
  bogey: 1,
  double_bogey: 0,
  worse: 0,
};

export const DEFAULT_MODIFIED_STABLEFORD: ModifiedStablefordValues = {
  eagle: 5,
  birdie: 2,
  par: 0,
  bogey: -1,
  double_bogey: -3,
};

export interface TournamentGameConfig {
  type: TournamentGameType;
  name: string;
  config: {
    handicap_pct?: number;
    stableford_values?: ModifiedStablefordValues;
  };
}

export interface LeaderboardConfig {
  name: string;
  metric: string;
  scope: 'individual' | 'team';
  sort: 'asc' | 'desc';
  show_rounds_breakdown: boolean;
}

export interface TeamConfig {
  name: string;
  color: string;
  playerIds: string[];
}

export interface RoundConfig {
  round_number: number;
  matchup_format: '1v1' | '2v2' | '4v4' | 'ffa';
  blind_teams: boolean;
  matchups: { group_name: string; playerIds: string[] }[];
  games: TournamentGameConfig[];
}

export interface TournamentSettings {
  description?: string;
  num_rounds: number;
  start_date?: string;
  end_date?: string;
  teams_enabled: boolean;
  teams?: TeamConfig[];
  games: TournamentGameConfig[];
  rounds_config?: RoundConfig[];
  leaderboards: LeaderboardConfig[];
}

/**
 * Calculate the number of handicap strokes a player receives on a specific hole.
 * Uses the standard golf allocation: if courseHandicap >= holeIndex, player gets 1 stroke.
 * If courseHandicap >= holeIndex + 18, player gets 2 strokes, etc.
 */
export function handicapStrokesOnHole(courseHandicap: number, holeHandicapIndex: number): number {
  if (courseHandicap <= 0) return 0;
  let strokes = 0;
  let remaining = courseHandicap;
  while (remaining >= holeHandicapIndex) {
    strokes++;
    remaining -= 18;
  }
  return strokes;
}

/**
 * Standard Stableford points for a hole.
 * gross: player's actual strokes on the hole
 * par: hole par
 * handicapStrokes: strokes received on this hole (0, 1, 2, etc.)
 */
export function calculateStablefordPoints(
  gross: number,
  par: number,
  handicapStrokes: number = 0
): number {
  const net = gross - handicapStrokes;
  const diff = net - par; // negative = under par
  if (diff <= -3) return 5; // albatross or better
  if (diff === -2) return 4; // eagle
  if (diff === -1) return 3; // birdie
  if (diff === 0) return 2;  // par
  if (diff === 1) return 1;  // bogey
  return 0; // double bogey or worse
}

/**
 * Modified Stableford with custom point values.
 */
export function calculateModifiedStablefordPoints(
  gross: number,
  par: number,
  handicapStrokes: number = 0,
  values: ModifiedStablefordValues = DEFAULT_MODIFIED_STABLEFORD
): number {
  const net = gross - handicapStrokes;
  const diff = net - par;
  if (diff <= -2) return values.eagle; // eagle or better
  if (diff === -1) return values.birdie;
  if (diff === 0) return values.par;
  if (diff === 1) return values.bogey;
  return values.double_bogey; // double bogey or worse
}

/**
 * Calculate net score for a single hole.
 */
export function calculateNetScore(gross: number, handicapStrokes: number): number {
  return gross - handicapStrokes;
}

// Game type metadata for UI display
export const GAME_TYPE_INFO: Record<TournamentGameType, {
  name: string;
  description: string;
  isTeam: boolean;
  defaultSort: 'asc' | 'desc';
}> = {
  stroke_gross: {
    name: 'Stroke Play (Gross)',
    description: 'Total strokes across all rounds, lowest wins',
    isTeam: false,
    defaultSort: 'asc',
  },
  stroke_net: {
    name: 'Stroke Play (Net)',
    description: 'Total net strokes (gross minus handicap allowance), lowest wins',
    isTeam: false,
    defaultSort: 'asc',
  },
  stableford: {
    name: 'Stableford',
    description: 'Points per hole based on score vs par. Cumulative across rounds.',
    isTeam: false,
    defaultSort: 'desc',
  },
  modified_stableford: {
    name: 'Modified Stableford',
    description: 'Custom point values set by the organizer',
    isTeam: false,
    defaultSort: 'desc',
  },
  team_stroke_gross: {
    name: 'Team Stroke Play (Gross)',
    description: 'Sum of all team members\' gross scores per round',
    isTeam: true,
    defaultSort: 'asc',
  },
  team_stroke_net: {
    name: 'Team Stroke Play (Net)',
    description: 'Sum of all team members\' net scores per round',
    isTeam: true,
    defaultSort: 'asc',
  },
  team_best_ball: {
    name: 'Team Best Ball',
    description: 'Best individual net score per hole counts for team',
    isTeam: true,
    defaultSort: 'asc',
  },
};
