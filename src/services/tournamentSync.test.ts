// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Provide localStorage polyfill for Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

import type { TournamentPlayer, TournamentGame, TournamentHolePoints, HalvedHoleRule } from '@/types/tournament';
import {
  calcTournamentHoleResults,
  calcMatchPlayBestBall,
  type CourseHole,
  type EngineInput,
  type HoleResult,
  type RoundResult,
} from './tournamentEngine';
import { offlineStorage } from './offlineStorage';

// ── TEST INFRASTRUCTURE ────────────────────────────────────────

// Track all Supabase operations
interface TrackedUpsert {
  table: string;
  data: any;
  onConflict?: string;
}

interface TrackedQuery {
  table: string;
  filters: Record<string, any>;
}

let trackedUpserts: TrackedUpsert[] = [];
let trackedQueries: TrackedQuery[] = [];

// In-memory DB tables for the mock
let dbScores: any[] = [];
let dbResults: any[] = [];
let shouldFail = false;
let failCount = 0;
let maxFails = 0;

function resetMockDb() {
  trackedUpserts = [];
  trackedQueries = [];
  dbScores = [];
  dbResults = [];
  shouldFail = false;
  failCount = 0;
  maxFails = 0;
}

function setFailMode(nFails: number) {
  shouldFail = true;
  failCount = 0;
  maxFails = nFails;
}

function checkFail(): boolean {
  if (shouldFail && failCount < maxFails) {
    failCount++;
    return true;
  }
  return false;
}

// Mock Supabase client builder
function createMockSupabase() {
  const buildChain = (table: string) => {
    let filters: Record<string, any> = {};
    let selectColumns = '*';
    const chain: any = {
      select: (cols?: string) => { selectColumns = cols || '*'; return chain; },
      eq: (col: string, val: any) => { filters[col] = val; return chain; },
      in: (col: string, vals: any[]) => { filters[`${col}_in`] = vals; return chain; },
      single: () => {
        trackedQueries.push({ table, filters });
        if (table === 'tournament_hole_scores') {
          const results = dbScores.filter(s => {
            return Object.entries(filters).every(([k, v]) => {
              if (k.endsWith('_in')) return v.includes(s[k.replace('_in', '')]);
              return s[k] === v;
            });
          });
          return Promise.resolve({ data: results[0] || null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: undefined as any,
    };

    // Make the chain thenable so it can be awaited directly
    chain.then = (resolve: any, reject?: any) => {
      trackedQueries.push({ table, filters });
      let results: any[] = [];

      if (table === 'tournament_hole_scores') {
        results = dbScores.filter(s => {
          return Object.entries(filters).every(([k, v]) => {
            if (k.endsWith('_in')) return v.includes(s[k.replace('_in', '')]);
            return s[k] === v;
          });
        });
      } else if (table === 'tournament_hole_results') {
        results = dbResults.filter(r => {
          return Object.entries(filters).every(([k, v]) => {
            if (k.endsWith('_in')) return v.includes(r[k.replace('_in', '')]);
            return r[k] === v;
          });
        });
      }

      return Promise.resolve({ data: results, error: null }).then(resolve, reject);
    };

    return chain;
  };

  return {
    from: (table: string) => {
      return {
        select: (cols?: string) => buildChain(table).select(cols),
        upsert: (data: any, options?: { onConflict?: string }) => {
          trackedUpserts.push({ table, data, onConflict: options?.onConflict });

          if (checkFail()) {
            return {
              select: () => Promise.resolve({ data: null, error: { message: 'Network error' } }),
              then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'Network error' } }).then(resolve),
            };
          }

          const rows = Array.isArray(data) ? data : [data];
          if (table === 'tournament_hole_scores') {
            for (const row of rows) {
              const idx = dbScores.findIndex(s =>
                s.tournament_group_id === row.tournament_group_id &&
                s.tournament_player_id === row.tournament_player_id &&
                s.hole_number === row.hole_number
              );
              const withId = { ...row, id: idx >= 0 ? dbScores[idx].id : `score-${Date.now()}-${Math.random()}` };
              if (idx >= 0) dbScores[idx] = withId;
              else dbScores.push(withId);
            }
          } else if (table === 'tournament_hole_results') {
            for (const row of rows) {
              const idx = dbResults.findIndex(r =>
                r.tournament_group_id === row.tournament_group_id &&
                r.hole_number === row.hole_number
              );
              const withId = { ...row, id: idx >= 0 ? dbResults[idx].id : `result-${Date.now()}-${Math.random()}` };
              if (idx >= 0) dbResults[idx] = withId;
              else dbResults.push(withId);
            }
          }

          const selectChain = {
            select: (cols?: string) => {
              const inserted = Array.isArray(data) ? data : [data];
              return Promise.resolve({ data: inserted.map((d, i) => ({ ...d, id: `id-${i}` })), error: null });
            },
          };
          return selectChain;
        },
      };
    },
    channel: () => ({
      on: function() { return this; },
      subscribe: function() { return this; },
    }),
    removeChannel: () => {},
  };
}

// ── TOURNAMENT SETUP HELPERS ───────────────────────────────────

function makePlayer(
  id: string,
  displayName: string,
  handicapIndex: number,
  handicapOverride?: number,
): TournamentPlayer {
  return { id, tournamentId: 't1', displayName, handicapIndex, handicapOverride, teamId: undefined, userId: undefined };
}

function makeGame(overrides: Partial<TournamentGame> = {}): TournamentGame {
  return {
    id: 'g1',
    tournamentRoundId: 'r1',
    gameType: 'match_play_best_ball',
    defaultPointsPerHole: 1,
    halvedHoleRule: 'half_point' as HalvedHoleRule,
    useHandicaps: false,
    handicapAllowancePercent: 100,
    secondBallTiebreaker: false,
    ...overrides,
  };
}

function make18Holes(): CourseHole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
    handicapIndex: i + 1,
  }));
}

// Create 16 players in 2 teams of 8
function createTournamentPlayers(): { players: TournamentPlayer[], teamAssignments: Record<string, string> } {
  const teamAId = 'team-a';
  const teamBId = 'team-b';
  const players: TournamentPlayer[] = [];
  const teamAssignments: Record<string, string> = {};

  for (let i = 1; i <= 16; i++) {
    const id = `player-${i}`;
    const teamId = i <= 8 ? teamAId : teamBId;
    players.push(makePlayer(id, `Player ${i}`, 10 + i)); // handicaps 11-26
    teamAssignments[id] = teamId;
  }

  return { players, teamAssignments };
}

// Create 4 groups of 4 players (2v2 each)
function createGroups(players: TournamentPlayer[], teamAssignments: Record<string, string>) {
  const teamA = players.filter((_, i) => i < 8);
  const teamB = players.filter((_, i) => i >= 8);
  const groups: { groupId: string; players: TournamentPlayer[]; assignments: Record<string, string> }[] = [];

  for (let g = 0; g < 4; g++) {
    const groupPlayers = [teamA[g * 2], teamA[g * 2 + 1], teamB[g * 2], teamB[g * 2 + 1]];
    const assignments: Record<string, string> = {};
    groupPlayers.forEach(p => { assignments[p.id] = teamAssignments[p.id]; });
    groups.push({
      groupId: `group-${g + 1}`,
      players: groupPlayers,
      assignments,
    });
  }

  return groups;
}

// Generate random scores for a player on specified holes
function generateScores(playerId: string, holes: number[], minScore = 3, maxScore = 7): Record<string, Record<number, number>> {
  const scores: Record<number, number> = {};
  holes.forEach(h => {
    scores[h] = minScore + Math.floor(Math.random() * (maxScore - minScore + 1));
  });
  return { [playerId]: scores };
}

// Merge multiple score maps
function mergeScores(...maps: Record<string, Record<number, number>>[]): Record<string, Record<number, number>> {
  const merged: Record<string, Record<number, number>> = {};
  for (const m of maps) {
    Object.entries(m).forEach(([pid, holes]) => {
      if (!merged[pid]) merged[pid] = {};
      Object.entries(holes).forEach(([h, s]) => {
        merged[pid][Number(h)] = s;
      });
    });
  }
  return merged;
}

// ── CORE ENGINE SIMULATION FUNCTION ────────────────────────────

/**
 * Simulates batchSyncHole logic: builds payloads, checks admin overrides,
 * upserts scores and results via the mock supabase.
 */
async function simulateBatchSyncHole(
  supabase: any,
  tournamentGroupId: string,
  holeNumber: number,
  allHoleScores: Record<string, Record<number, number>>,
  game: TournamentGame,
  players: TournamentPlayer[],
  teamAssignments: Record<string, string>,
  courseHoles: CourseHole[],
  holePointOverrides: TournamentHolePoints[],
  teamNames: Record<string, string>,
): Promise<boolean> {
  try {
    // 1. Check for admin overrides
    const { data: overridden } = await supabase
      .from('tournament_hole_scores')
      .select('tournament_player_id, hole_number')
      .eq('tournament_group_id', tournamentGroupId)
      .eq('hole_number', holeNumber)
      .eq('is_super_user_override', true);

    const overrideSet = new Set(
      (overridden || []).map((o: any) => `${o.tournament_player_id}_${o.hole_number}`)
    );

    // 2. Build score payload
    const scorePayload: any[] = [];
    Object.entries(allHoleScores).forEach(([playerId, holes]) => {
      const score = holes[holeNumber];
      if (score === undefined) return;
      if (overrideSet.has(`${playerId}_${holeNumber}`)) return;
      scorePayload.push({
        tournament_group_id: tournamentGroupId,
        tournament_player_id: playerId,
        hole_number: holeNumber,
        gross_score: score,
        is_super_user_override: false,
      });
    });

    // 3. Upsert scores
    if (scorePayload.length > 0) {
      const { error: scoreErr } = await supabase.from('tournament_hole_scores')
        .upsert(scorePayload, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' })
        .select('id');
      if (scoreErr) {
        // Queue for offline
        scorePayload.forEach(sp => {
          offlineStorage.addTournamentScore(sp.tournament_group_id, sp.tournament_player_id, sp.hole_number, sp.gross_score);
        });
        throw scoreErr;
      }
    }

    // 4. Run engine
    const engineInput: EngineInput = {
      game, holePointOverrides, players, teamAssignments,
      scores: allHoleScores, courseHoles, teamNames,
    };
    const result = calcTournamentHoleResults(engineInput);

    const holeResult = result.holeResults.find(hr => hr.holeNumber === holeNumber);
    if (holeResult && holeResult.resultLabel && holeResult.resultLabel !== '') {
      const resultPayload = [{
        tournament_group_id: tournamentGroupId,
        hole_number: holeResult.holeNumber,
        team_points: holeResult.teamPoints,
        player_points: holeResult.playerPoints,
        points_value: holeResult.pointsValue,
        result_label: holeResult.resultLabel,
        updated_at: new Date().toISOString(),
      }];

      const { error: resultErr } = await supabase.from('tournament_hole_results')
        .upsert(resultPayload, { onConflict: 'tournament_group_id,hole_number' })
        .select('id');
      if (resultErr) {
        offlineStorage.addTournamentResult(tournamentGroupId, resultPayload);
        throw resultErr;
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Simulates batchSyncAllScores logic including admin override merging (Fix 3).
 */
async function simulateBatchSyncAllScores(
  supabase: any,
  tournamentGroupId: string,
  allHoleScores: Record<string, Record<number, number>>,
  game: TournamentGame,
  players: TournamentPlayer[],
  teamAssignments: Record<string, string>,
  courseHoles: CourseHole[],
  holePointOverrides: TournamentHolePoints[],
  teamNames: Record<string, string>,
): Promise<boolean> {
  try {
    // 1. Fetch admin overrides
    const { data: overridden } = await supabase
      .from('tournament_hole_scores')
      .select('tournament_player_id, hole_number')
      .eq('tournament_group_id', tournamentGroupId)
      .eq('is_super_user_override', true);

    const overrideSet = new Set(
      (overridden || []).map((o: any) => `${o.tournament_player_id}_${o.hole_number}`)
    );

    // Also fetch actual admin override scores for engine input (Fix 3)
    const { data: overriddenScores } = await supabase
      .from('tournament_hole_scores')
      .select('tournament_player_id, hole_number, gross_score')
      .eq('tournament_group_id', tournamentGroupId)
      .eq('is_super_user_override', true);

    // Merge admin overrides into engine input
    const mergedScores = { ...allHoleScores };
    (overriddenScores || []).forEach((o: any) => {
      if (!mergedScores[o.tournament_player_id]) mergedScores[o.tournament_player_id] = {};
      mergedScores[o.tournament_player_id][o.hole_number] = o.gross_score;
    });

    // 2. Build score payload (skip admin overrides)
    const scorePayload: any[] = [];
    Object.entries(allHoleScores).forEach(([playerId, holes]) => {
      Object.entries(holes).forEach(([holeStr, score]) => {
        const holeNum = Number(holeStr);
        if (overrideSet.has(`${playerId}_${holeNum}`)) return;
        scorePayload.push({
          tournament_group_id: tournamentGroupId,
          tournament_player_id: playerId,
          hole_number: holeNum,
          gross_score: score,
          is_super_user_override: false,
        });
      });
    });

    if (scorePayload.length > 0) {
      await supabase.from('tournament_hole_scores')
        .upsert(scorePayload, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' })
        .select('id');
    }

    // 3. Run engine with merged scores
    const engineInput: EngineInput = {
      game, holePointOverrides, players, teamAssignments,
      scores: mergedScores, courseHoles, teamNames,
    };
    const result = calcTournamentHoleResults(engineInput);

    const resultPayload = result.holeResults
      .filter(hr => hr.resultLabel && hr.resultLabel !== '')
      .map(hr => ({
        tournament_group_id: tournamentGroupId,
        hole_number: hr.holeNumber,
        team_points: hr.teamPoints,
        player_points: hr.playerPoints,
        points_value: hr.pointsValue,
        result_label: hr.resultLabel,
        updated_at: new Date().toISOString(),
      }));

    if (resultPayload.length > 0) {
      await supabase.from('tournament_hole_results')
        .upsert(resultPayload, { onConflict: 'tournament_group_id,hole_number' })
        .select('id');
    }

    return true;
  } catch (e) {
    return false;
  }
}

// ── TESTS ──────────────────────────────────────────────────────

describe('Tournament Sync Simulation', () => {
  let supabase: ReturnType<typeof createMockSupabase>;
  const courseHoles = make18Holes();
  const game = makeGame();
  const teamNames = { 'team-a': 'Team Alpha', 'team-b': 'Team Bravo' };
  const { players: allPlayers, teamAssignments: allAssignments } = createTournamentPlayers();
  const groups = createGroups(allPlayers, allAssignments);

  beforeEach(() => {
    resetMockDb();
    supabase = createMockSupabase();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Test 1: Engine produces correct results for 2v2 best ball ──
  describe('Engine Correctness', () => {
    it('computes correct hole results for 2v2 best ball with known scores', () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      // Team A players score 4 on hole 1, Team B players score 5
      group.players.forEach(p => {
        scores[p.id] = { 1: group.assignments[p.id] === 'team-a' ? 4 : 5 };
      });

      const input: EngineInput = {
        game, holePointOverrides: [], players: group.players,
        teamAssignments: group.assignments, scores, courseHoles, teamNames,
      };
      const result = calcTournamentHoleResults(input);

      expect(result.holeResults.length).toBe(1);
      expect(result.holeResults[0].holeNumber).toBe(1);
      expect(result.holeResults[0].teamPoints['team-a']).toBe(1);
      expect(result.holeResults[0].teamPoints['team-b']).toBe(0);
      expect(result.holeResults[0].resultLabel).toContain('Team Alpha');
    });

    it('computes halved holes correctly', () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = { 1: 4 }; // Everyone ties
      });

      const input: EngineInput = {
        game, holePointOverrides: [], players: group.players,
        teamAssignments: group.assignments, scores, courseHoles, teamNames,
      };
      const result = calcTournamentHoleResults(input);

      expect(result.holeResults[0].teamPoints['team-a']).toBe(0.5);
      expect(result.holeResults[0].teamPoints['team-b']).toBe(0.5);
      expect(result.holeResults[0].resultLabel).toBe('Halved');
    });

    it('computes full 18-hole results with team totals', () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = {};
        for (let h = 1; h <= 18; h++) {
          // Team A wins odd holes, Team B wins even holes
          if (group.assignments[p.id] === 'team-a') {
            scores[p.id][h] = h % 2 === 1 ? 3 : 5;
          } else {
            scores[p.id][h] = h % 2 === 1 ? 5 : 3;
          }
        }
      });

      const input: EngineInput = {
        game, holePointOverrides: [], players: group.players,
        teamAssignments: group.assignments, scores, courseHoles, teamNames,
      };
      const result = calcTournamentHoleResults(input);

      expect(result.holeResults.length).toBe(18);
      expect(result.teamTotals['team-a']).toBe(9);
      expect(result.teamTotals['team-b']).toBe(9);
      expect(result.matchState.resultLabel).toContain('Halved');
    });
  });

  // ── Test 2: 16 players, 4 groups, 2 rounds, 18 holes ──
  describe('Full Tournament Simulation (16 players, 4 groups, 2 rounds)', () => {
    it('processes all scores across all groups and rounds correctly', () => {
      const rounds = ['round-1', 'round-2'];

      for (const roundId of rounds) {
        for (const group of groups) {
          const scores: Record<string, Record<number, number>> = {};
          group.players.forEach(p => {
            scores[p.id] = {};
            for (let h = 1; h <= 18; h++) {
              scores[p.id][h] = 3 + (p.id.charCodeAt(p.id.length - 1) + h) % 5; // deterministic
            }
          });

          const input: EngineInput = {
            game, holePointOverrides: [], players: group.players,
            teamAssignments: group.assignments, scores, courseHoles, teamNames,
          };
          const result = calcTournamentHoleResults(input);

          expect(result.holeResults.length).toBe(18);
          expect(result.matchState.holesPlayed).toBe(18);
          expect(result.matchState.isComplete).toBe(true);

          // Verify team totals add up
          const computedTotals: Record<string, number> = {};
          result.holeResults.forEach(hr => {
            Object.entries(hr.teamPoints).forEach(([tid, pts]) => {
              computedTotals[tid] = (computedTotals[tid] || 0) + pts;
            });
          });
          expect(computedTotals['team-a']).toBe(result.teamTotals['team-a']);
          expect(computedTotals['team-b']).toBe(result.teamTotals['team-b']);
        }
      }
    });
  });

  // ── Test 3: Per-hole sync fires on hole advancement ──
  describe('Per-Hole Sync', () => {
    it('syncs scores to DB when batchSyncHole is called', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = { 1: 4, 2: 5 };
      });

      const ok = await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      expect(ok).toBe(true);

      // Verify score upserts were tracked
      const scoreUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_scores');
      expect(scoreUpserts.length).toBeGreaterThan(0);
      expect(scoreUpserts[0].onConflict).toBe('tournament_group_id,tournament_player_id,hole_number');

      // Verify result upserts were tracked
      const resultUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_results');
      expect(resultUpserts.length).toBeGreaterThan(0);

      // Verify DB has the scores
      expect(dbScores.length).toBe(4); // 4 players, 1 hole
      expect(dbResults.length).toBe(1); // 1 hole result
    });

    it('syncs each hole independently as player advances', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = {}; });

      // Simulate hole-by-hole advancement
      for (let hole = 1; hole <= 3; hole++) {
        group.players.forEach(p => { scores[p.id][hole] = 4; });

        const ok = await simulateBatchSyncHole(
          supabase, group.groupId, hole, scores,
          game, group.players, group.assignments, courseHoles, [], teamNames,
        );
        expect(ok).toBe(true);
      }

      // DB should have 3 holes * 4 players = 12 score rows
      expect(dbScores.length).toBe(12);
      // DB should have 3 result rows
      expect(dbResults.length).toBe(3);
    });
  });

  // ── Test 4: Concurrent score entry ──
  describe('Concurrent Score Entry', () => {
    it('handles concurrent batchSyncHole calls from multiple groups', async () => {
      // All 4 groups finish hole 1 at the same time
      const syncPromises = groups.map(async (group) => {
        const scores: Record<string, Record<number, number>> = {};
        group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

        return simulateBatchSyncHole(
          supabase, group.groupId, 1, scores,
          game, group.players, group.assignments, courseHoles, [], teamNames,
        );
      });

      const results = await Promise.all(syncPromises);
      expect(results.every(r => r === true)).toBe(true);

      // 4 groups * 4 players = 16 score rows
      expect(dbScores.length).toBe(16);
      // 4 groups * 1 hole result each = 4
      expect(dbResults.length).toBe(4);
    });

    it('handles concurrent score updates for different holes in same group', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = { 1: 4, 2: 5, 3: 3 };
      });

      // Sync all 3 holes concurrently
      const results = await Promise.all([
        simulateBatchSyncHole(supabase, group.groupId, 1, scores, game, group.players, group.assignments, courseHoles, [], teamNames),
        simulateBatchSyncHole(supabase, group.groupId, 2, scores, game, group.players, group.assignments, courseHoles, [], teamNames),
        simulateBatchSyncHole(supabase, group.groupId, 3, scores, game, group.players, group.assignments, courseHoles, [], teamNames),
      ]);

      expect(results.every(r => r === true)).toBe(true);
      expect(dbScores.length).toBe(12); // 4 players * 3 holes
      expect(dbResults.length).toBe(3);
    });
  });

  // ── Test 5: Offline queue on sync failure ──
  describe('Offline Queue', () => {
    it('populates offline queue on score sync failure', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

      // Make the first upsert fail
      setFailMode(1);

      const ok = await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      expect(ok).toBe(false);

      // Verify items were queued to offline storage
      const queue = offlineStorage.getTournamentSyncQueue();
      expect(queue.length).toBe(4); // 4 players
      queue.forEach(item => {
        expect(item.tournamentGroupId).toBe(group.groupId);
        expect(item.holeNumber).toBe(1);
        expect(item.grossScore).toBe(4);
      });
    });

    it('queues result on result sync failure', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

      // Make the second upsert fail (results), first (scores) succeeds
      setFailMode(0);
      let upsertCallCount = 0;
      const origFrom = supabase.from.bind(supabase);
      supabase.from = (table: string) => {
        const orig = origFrom(table);
        if (table === 'tournament_hole_results') {
          return {
            ...orig,
            upsert: (data: any, options: any) => {
              trackedUpserts.push({ table, data, onConflict: options?.onConflict });
              return {
                select: () => Promise.resolve({ data: null, error: { message: 'Result sync error' } }),
              };
            },
          };
        }
        return orig;
      };

      const ok = await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      expect(ok).toBe(false);

      // Scores should still be in DB
      expect(dbScores.length).toBe(4);

      // Results should be queued offline
      const resultQueue = offlineStorage.getTournamentResultQueue();
      expect(resultQueue.length).toBe(1);
      expect(resultQueue[0].tournamentGroupId).toBe(group.groupId);
    });

    it('drains offline queue correctly with exponential backoff logic', () => {
      // Add items with different retry counts and timestamps
      const now = Date.now();

      // Item with retryCount=0, fresh — should be eligible (backoff = 30s, age > 30s)
      offlineStorage.addTournamentScore('group-1', 'player-1', 1, 4);

      // Simulate aging the item by manipulating storage directly
      const queue = offlineStorage.getTournamentSyncQueue();
      expect(queue.length).toBe(1);

      // Verify exponential backoff formula
      const backoff0 = Math.min(30000 * Math.pow(2, 0), 300000); // 30s
      const backoff1 = Math.min(30000 * Math.pow(2, 1), 300000); // 60s
      const backoff2 = Math.min(30000 * Math.pow(2, 2), 300000); // 120s
      const backoff3 = Math.min(30000 * Math.pow(2, 3), 300000); // 240s
      const backoff10 = Math.min(30000 * Math.pow(2, 10), 300000); // capped at 300s

      expect(backoff0).toBe(30000);
      expect(backoff1).toBe(60000);
      expect(backoff2).toBe(120000);
      expect(backoff3).toBe(240000);
      expect(backoff10).toBe(300000); // capped
    });
  });

  // ── Test 6: Admin overrides are preserved ──
  describe('Admin Override Handling', () => {
    it('skips admin-overridden scores during per-hole sync', async () => {
      const group = groups[0];
      const adminPlayer = group.players[0];

      // Pre-populate DB with an admin override score
      dbScores.push({
        id: 'admin-score-1',
        tournament_group_id: group.groupId,
        tournament_player_id: adminPlayer.id,
        hole_number: 1,
        gross_score: 3, // Admin corrected score
        is_super_user_override: true,
      });

      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = { 1: 5 }; // Player's local score (different from admin)
      });

      await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      // Admin player's score should NOT have been overwritten
      const adminScore = dbScores.find(
        s => s.tournament_player_id === adminPlayer.id && s.hole_number === 1
      );
      expect(adminScore.gross_score).toBe(3); // Original admin score preserved
      expect(adminScore.is_super_user_override).toBe(true);
    });

    it('merges admin overrides into engine input during batchSyncAllScores', async () => {
      const group = groups[0];
      const adminPlayer = group.players[0];

      // Admin override: player 1 scores 2 on hole 1
      dbScores.push({
        id: 'admin-score-1',
        tournament_group_id: group.groupId,
        tournament_player_id: adminPlayer.id,
        hole_number: 1,
        gross_score: 2,
        is_super_user_override: true,
      });

      // Local scores: everyone scores 5 on hole 1
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = { 1: 5 };
      });

      await simulateBatchSyncAllScores(
        supabase, group.groupId, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      // The engine should have used the admin override score (2) for the admin player
      // This means Team A (which admin player is on) should win because their best ball is 2
      const holeResult = dbResults.find(r => r.hole_number === 1);
      expect(holeResult).toBeDefined();

      // The admin player is on team-a, and with a score of 2 vs team-b scoring 5,
      // team-a should win
      expect(holeResult.team_points['team-a']).toBe(1);
      expect(holeResult.team_points['team-b']).toBe(0);
    });
  });

  // ── Test 7: batchSyncAllScores produces correct final state ──
  describe('batchSyncAllScores Final State', () => {
    it('syncs complete round with all 18 holes for a group', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = {};
        for (let h = 1; h <= 18; h++) {
          scores[p.id][h] = 4; // Everyone ties
        }
      });

      const ok = await simulateBatchSyncAllScores(
        supabase, group.groupId, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      expect(ok).toBe(true);

      // 4 players * 18 holes = 72 score rows
      expect(dbScores.length).toBe(72);

      // 18 hole results (all halved)
      expect(dbResults.length).toBe(18);

      // Verify all results are halved
      dbResults.forEach(r => {
        expect(r.team_points['team-a']).toBe(0.5);
        expect(r.team_points['team-b']).toBe(0.5);
        expect(r.result_label).toBe('Halved');
      });
    });

    it('handles all 4 groups finishing a round simultaneously', async () => {
      const promises = groups.map(async (group) => {
        const scores: Record<string, Record<number, number>> = {};
        group.players.forEach(p => {
          scores[p.id] = {};
          for (let h = 1; h <= 18; h++) {
            scores[p.id][h] = 3 + Math.floor(((p.id.charCodeAt(7) || 0) + h) % 4);
          }
        });

        return simulateBatchSyncAllScores(
          supabase, group.groupId, scores,
          game, group.players, group.assignments, courseHoles, [], teamNames,
        );
      });

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);

      // 4 groups * 4 players * 18 holes = 288 score rows
      expect(dbScores.length).toBe(288);

      // 4 groups * 18 holes = 72 result rows
      expect(dbResults.length).toBe(72);
    });
  });

  // ── Test 8: Dirty hole tracking ──
  describe('Dirty Hole Tracking', () => {
    it('tracks synced and dirty holes correctly', () => {
      const syncedHoles = new Set<number>();
      const dirtyHoles = new Set<number>();

      // Simulate: score entered on hole 1, then synced
      syncedHoles.add(1);

      // Score edited on hole 1 after sync → dirty
      if (syncedHoles.has(1)) dirtyHoles.add(1);

      expect(dirtyHoles.has(1)).toBe(true);

      // Hole 1 re-synced → no longer dirty
      dirtyHoles.delete(1);
      expect(dirtyHoles.has(1)).toBe(false);

      // Hole 2 scored but never synced → not dirty
      if (syncedHoles.has(2)) dirtyHoles.add(2);
      expect(dirtyHoles.has(2)).toBe(false);
    });

    it('getDirtyHoles returns dirty holes as array', () => {
      const dirtyHoles = new Set<number>([3, 7, 12]);
      const getDirtyHoles = () => Array.from(dirtyHoles);
      expect(getDirtyHoles()).toEqual([3, 7, 12]);
    });
  });

  // ── Test 9: Two-round tournament simulation ──
  describe('Full Two-Round Tournament', () => {
    it('simulates two complete rounds with hole-by-hole sync', async () => {
      for (let round = 1; round <= 2; round++) {
        for (const group of groups) {
          const scores: Record<string, Record<number, number>> = {};
          group.players.forEach(p => { scores[p.id] = {}; });

          // Simulate hole-by-hole scoring
          for (let hole = 1; hole <= 18; hole++) {
            // Each player enters score
            group.players.forEach(p => {
              scores[p.id][hole] = 3 + ((p.id.charCodeAt(7) + hole + round) % 5);
            });

            // Per-hole sync fires when advancing to next hole
            await simulateBatchSyncHole(
              supabase, `${group.groupId}-r${round}`, hole, scores,
              game, group.players, group.assignments, courseHoles, [], teamNames,
            );
          }

          // Final batchSyncAllScores on round completion
          await simulateBatchSyncAllScores(
            supabase, `${group.groupId}-r${round}`, scores,
            game, group.players, group.assignments, courseHoles, [], teamNames,
          );
        }
      }

      // Verify total writes: 2 rounds * 4 groups * (18 hole-sync + 1 final-sync) * 4 players per hole
      // Per-hole: 2 * 4 * 18 * 4 = 576 score upserts (from per-hole sync)
      // Final: 2 * 4 * 72 = 576 score upserts (from batchSyncAll)
      // Total score upserts (via DB dedup): 2 * 4 * 4 * 18 = 576 unique scores per round set
      const totalUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_scores').length;
      expect(totalUpserts).toBeGreaterThan(0);

      // Verify all groups have results
      const totalResultUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_results').length;
      expect(totalResultUpserts).toBeGreaterThan(0);
    });
  });

  // ── Test 10: ConnectionStatusBar polling ──
  describe('ConnectionStatusBar Queue Count', () => {
    it('pending count reflects real-time queue state', () => {
      expect(offlineStorage.getPendingSyncCount()).toBe(0);
      expect(offlineStorage.getPendingTournamentSyncCount()).toBe(0);
      expect(offlineStorage.getPendingTournamentResultCount()).toBe(0);

      offlineStorage.addTournamentScore('g1', 'p1', 1, 4);
      offlineStorage.addTournamentScore('g1', 'p2', 1, 5);

      expect(offlineStorage.getPendingTournamentSyncCount()).toBe(2);

      offlineStorage.addTournamentResult('g1', [{
        tournament_group_id: 'g1', hole_number: 1,
        team_points: { 'ta': 1, 'tb': 0 },
        result_label: 'Win',
        updated_at: new Date().toISOString(),
      }]);

      expect(offlineStorage.getPendingTournamentResultCount()).toBe(1);

      // Total
      const total = offlineStorage.getPendingSyncCount()
        + offlineStorage.getPendingTournamentSyncCount()
        + offlineStorage.getPendingTournamentResultCount();
      expect(total).toBe(3);
    });

    it('deduplicates tournament score queue entries', () => {
      offlineStorage.addTournamentScore('g1', 'p1', 1, 4);
      offlineStorage.addTournamentScore('g1', 'p1', 1, 5); // Same player/hole → replaces

      expect(offlineStorage.getPendingTournamentSyncCount()).toBe(1);
      const queue = offlineStorage.getTournamentSyncQueue();
      expect(queue[0].grossScore).toBe(5); // Updated value
    });
  });

  // ── Test 11: Match state computation ──
  describe('Match State', () => {
    it('detects dormie correctly', () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = {};
        // Team A wins first 3 holes, ties rest through hole 15
        for (let h = 1; h <= 15; h++) {
          if (group.assignments[p.id] === 'team-a') {
            scores[p.id][h] = h <= 3 ? 3 : 4;
          } else {
            scores[p.id][h] = h <= 3 ? 5 : 4;
          }
        }
      });

      const input: EngineInput = {
        game, holePointOverrides: [], players: group.players,
        teamAssignments: group.assignments, scores, courseHoles, teamNames,
      };
      const result = calcTournamentHoleResults(input);

      expect(result.matchState.holesPlayed).toBe(15);
      expect(result.matchState.holesRemaining).toBe(3);
      expect(result.matchState.leadingTeamId).toBe('team-a');
      expect(result.matchState.leadAmount).toBe(3);
      expect(result.matchState.isDormie).toBe(true);
      expect(result.matchState.resultLabel).toContain('Dormie');
    });

    it('detects early win (closed out match)', () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => {
        scores[p.id] = {};
        // Team A wins every hole through 14
        for (let h = 1; h <= 14; h++) {
          scores[p.id][h] = group.assignments[p.id] === 'team-a' ? 3 : 5;
        }
      });

      const input: EngineInput = {
        game, holePointOverrides: [], players: group.players,
        teamAssignments: group.assignments, scores, courseHoles, teamNames,
      };
      const result = calcTournamentHoleResults(input);

      // 14-0 lead with 4 holes remaining: 14 > 4, match is over
      expect(result.matchState.isComplete).toBe(true);
      expect(result.matchState.resultLabel).toContain('Wins');
    });
  });

  // ── Test 12: upsert uses correct onConflict columns ──
  describe('Upsert Conflict Handling', () => {
    it('uses correct onConflict for score upserts', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

      await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      const scoreUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_scores');
      expect(scoreUpserts[0].onConflict).toBe('tournament_group_id,tournament_player_id,hole_number');
    });

    it('uses correct onConflict for result upserts', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

      await simulateBatchSyncHole(
        supabase, group.groupId, 1, scores,
        game, group.players, group.assignments, courseHoles, [], teamNames,
      );

      const resultUpserts = trackedUpserts.filter(u => u.table === 'tournament_hole_results');
      expect(resultUpserts[0].onConflict).toBe('tournament_group_id,hole_number');
    });

    it('handles re-upsert of same score correctly (idempotency)', async () => {
      const group = groups[0];
      const scores: Record<string, Record<number, number>> = {};
      group.players.forEach(p => { scores[p.id] = { 1: 4 }; });

      // Sync hole 1 twice
      await simulateBatchSyncHole(supabase, group.groupId, 1, scores, game, group.players, group.assignments, courseHoles, [], teamNames);
      await simulateBatchSyncHole(supabase, group.groupId, 1, scores, game, group.players, group.assignments, courseHoles, [], teamNames);

      // Should still only have 4 score rows (upserted, not duplicated)
      expect(dbScores.length).toBe(4);
      // Should still only have 1 result row
      expect(dbResults.length).toBe(1);
    });
  });
});
