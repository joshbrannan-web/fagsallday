import type { Course } from '@/types';

// ── STATUS & ENUM TYPES ──────────────────────────────────────

export type TournamentStatus = 'setup' | 'active' | 'completed' | 'archived';
export type RoundStatus = 'pending' | 'active' | 'completed';
export type GroupStatus = 'pending' | 'active' | 'submitted';
export type HalvedHoleRule = 'half_point' | 'no_points';

export type TournamentGameType =
  | 'match_play_individual'
  | 'match_play_best_ball'
  | 'match_play_gross_best_ball'
  | 'scramble_2'
  | 'scramble_4'
  | 'alternate_shot_twosomes'
  | 'alternate_shot_foursomes'
  | 'tournament_sixes'
  | 'blind_gross_best_ball';

export type ScoreboardType =
  | 'team_points'
  | 'individual_gross'
  | 'individual_net'
  | 'individual_points'
  | 'team_round_result'
  | 'individual_round_result';

// ── CONFIG TYPES ─────────────────────────────────────────────

export interface SixesSegmentConfig {
  holes: 'front' | 'middle' | 'back'; // holes 1-6, 7-12, 13-18
  rules: string;                       // free text rules for this segment
  formatNotes: string;                 // e.g. "Match Play, 1pt per hole, no handicaps"
}

// ── TABLE TYPES ──────────────────────────────────────────────

export interface TournamentAdmin {
  id: string;
  userId: string;
  grantedBy?: string;
  grantedAt: string;
}

export interface Tournament {
  id: string;
  createdBy: string;
  name: string;
  description?: string;
  status: TournamentStatus;
  joinCode: string;
  numRounds: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  color: string;
  displayOrder: number;
}

export interface TournamentPlayer {
  id: string;
  tournamentId: string;
  userId?: string;
  displayName: string;
  handicapIndex: number;
  handicapOverride?: number;
  teamId?: string;
  // Effective handicap = handicapOverride ?? handicapIndex
}

export interface TournamentRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  name?: string;
  courseData: Course; // existing Course type from src/types
  roundDate?: string;
  status: RoundStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentGame {
  id: string;
  tournamentRoundId: string;
  gameType: TournamentGameType;
  defaultPointsPerHole: number;
  halvedHoleRule: HalvedHoleRule;
  secondBallTiebreaker: boolean;
  useHandicaps: boolean;
  handicapAllowancePercent: number;
  maxScorePerHole?: number;
  sixesConfig?: SixesSegmentConfig[];
  rulesText?: string;
  sixesFormat?: 'match_play' | 'sum_of_strokes';
  sixesSegmentPoints?: [number, number, number];
}

export interface TournamentHolePoints {
  id: string;
  tournamentGameId: string;
  holeNumber: number;
  points: number;
}

export interface TournamentGroup {
  id: string;
  tournamentRoundId: string;
  groupNumber: number;
  teamMatchup?: { teamAId: string; teamBId: string };
  roundId?: string; // links to existing rounds table
  status: GroupStatus;
  submittedAt?: string;
}

export interface TournamentGroupPlayer {
  id: string;
  tournamentGroupId: string;
  tournamentPlayerId: string;
  teamId: string;
}

export interface TournamentHoleScore {
  id: string;
  tournamentGroupId: string;
  tournamentPlayerId: string;
  holeNumber: number;
  grossScore?: number;
  isSuperUserOverride: boolean;
  updatedAt: string;
}

export interface TournamentHoleResult {
  id: string;
  tournamentGroupId: string;
  holeNumber: number;
  teamPoints: Record<string, number>;   // { teamId: points }
  playerPoints: Record<string, number>; // { tournamentPlayerId: points }
  pointsValue: number;
  resultLabel?: string;                 // "USA wins", "Halved", "EUR wins"
  updatedAt: string;
}

export interface TournamentScoreboard {
  id: string;
  tournamentId: string;
  name: string;
  displayOrder: number;
  scoreboardType: ScoreboardType;
  showRoundBreakdown: boolean;
  sortDirection: 'asc' | 'desc';
  sortMetric: 'total_points' | 'gross_score' | 'net_score' | 'wins';
}

export interface TournamentMember {
  id: string;
  tournamentId: string;
  userId: string;
  joinedAt: string;
}

// ── COMPUTED TYPES (used in UI, not stored) ──────────────────

export interface ScoreboardRow {
  rank: number;
  isTied: boolean;
  entity: TournamentPlayer | TournamentTeam;
  entityType: 'player' | 'team';
  roundValues: (number | null)[];  // one value per round
  total: number | null;
  thru: number;                    // holes completed in active round (18 = F)
  hasSuperUserOverride: boolean;
}

export interface MatchState {
  holesPlayed: number;
  leadingTeamId?: string;
  leadAmount: number;         // e.g. 3 = "3 UP"
  holesRemaining: number;
  isComplete: boolean;
  isDormie: boolean;
  resultLabel: string;        // "USA 3 UP", "HALVED", "EUR wins 2&1"
  teamTotals: Record<string, number>; // { teamId: totalPoints }
}
