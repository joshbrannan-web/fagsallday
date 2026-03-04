// @ts-nocheck
import { describe, it, expect } from 'vitest';
import type { TournamentPlayer, TournamentGame, TournamentGameType, HalvedHoleRule } from '@/types/tournament';
import {
  calcMatchPlayIndividual,
  calcMatchPlayBestBall,
  calcGrossBestBall,
  calcScramble,
  calcTournamentSixes,
  calcMatchState,
  strokesReceived,
  matchPlayStrokeDifference,
  type CourseHole,
  type EngineInput,
  type HoleResult,
} from './tournamentEngine';

// ── HELPERS ──────────────────────────────────────────────────

function makePlayer(
  id: string,
  displayName: string,
  handicapIndex: number,
  handicapOverride?: number,
): TournamentPlayer {
  return {
    id,
    tournamentId: 't1',
    displayName,
    handicapIndex,
    handicapOverride,
    teamId: undefined,
    userId: undefined,
  };
}

function makeGame(
  gameType: TournamentGameType,
  overrides: Partial<TournamentGame> = {},
): TournamentGame {
  return {
    id: 'g1',
    tournamentRoundId: 'r1',
    gameType,
    defaultPointsPerHole: 1,
    halvedHoleRule: 'half_point' as HalvedHoleRule,
    useHandicaps: false,
    handicapAllowancePercent: 100,
    secondBallTiebreaker: false,
    ...overrides,
  };
}

function makeHole(number: number, par: number, handicapIndex: number): CourseHole {
  return { number, par, handicapIndex };
}

function make18Holes(): CourseHole[] {
  return Array.from({ length: 18 }, (_, i) => makeHole(i + 1, 4, i + 1));
}

function singleHoleInput(
  game: TournamentGame,
  players: TournamentPlayer[],
  teamAssignments: Record<string, string>,
  scores: Record<string, Record<number, number>>,
  hole: CourseHole = makeHole(1, 4, 1),
): EngineInput {
  return {
    game,
    holePointOverrides: [],
    players,
    teamAssignments,
    scores,
    courseHoles: [hole],
  };
}

// ── 1. MATCH PLAY INDIVIDUAL ─────────────────────────────────

describe('Match Play Individual', () => {
  const pA = makePlayer('a', 'Player A', 0);
  const pB = makePlayer('b', 'Player B', 0);
  const teams = { a: 'teamA', b: 'teamB' };

  it('Test 1: lower net wins the hole', () => {
    const game = makeGame('match_play_individual');
    const input = singleHoleInput(game, [pA, pB], teams, {
      a: { 1: 3 },
      b: { 1: 4 },
    });
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].teamPoints['teamA']).toBe(1);
    expect(r.holeResults[0].teamPoints['teamB']).toBe(0);
    expect(r.holeResults[0].resultLabel).toBe('Player A wins');
  });

  it('Test 2: tied hole with half_point rule', () => {
    const game = makeGame('match_play_individual', { halvedHoleRule: 'half_point' });
    const input = singleHoleInput(game, [pA, pB], teams, {
      a: { 1: 4 },
      b: { 1: 4 },
    });
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].teamPoints['teamA']).toBe(0.5);
    expect(r.holeResults[0].teamPoints['teamB']).toBe(0.5);
    expect(r.holeResults[0].resultLabel).toBe('Halved');
  });

  it('Test 3: tied hole with no_points rule', () => {
    const game = makeGame('match_play_individual', { halvedHoleRule: 'no_points' });
    const input = singleHoleInput(game, [pA, pB], teams, {
      a: { 1: 4 },
      b: { 1: 4 },
    });
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].teamPoints['teamA']).toBe(0);
    expect(r.holeResults[0].teamPoints['teamB']).toBe(0);
    expect(r.holeResults[0].resultLabel).toBe('No points');
  });

  it('Test 4: handicap strokes applied correctly', () => {
    const pAh = makePlayer('a', 'Player A', 10);
    const pBh = makePlayer('b', 'Player B', 4);
    const game = makeGame('match_play_individual', { useHandicaps: true });
    // Difference = 6. Hole handicapIndex=5 → 5 ≤ 6, so Player A gets 1 stroke
    const hole = makeHole(1, 4, 5);
    // Both gross 5. Player A net = 5-1=4, Player B net = 5-0=5
    const input = singleHoleInput(game, [pAh, pBh], teams, {
      a: { 1: 5 },
      b: { 1: 5 },
    }, hole);
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].netScores['a']).toBe(4);
    expect(r.holeResults[0].netScores['b']).toBe(5);
    expect(r.holeResults[0].resultLabel).toBe('Player A wins');
  });

  it('Test 5: 18-hole totals calculated correctly', () => {
    const game = makeGame('match_play_individual', { halvedHoleRule: 'half_point' });
    const holes = make18Holes();
    const scoresA: Record<number, number> = {};
    const scoresB: Record<number, number> = {};
    // A wins holes 1-10, B wins 11-15, halved 16-18
    for (let i = 1; i <= 18; i++) {
      if (i <= 10) { scoresA[i] = 3; scoresB[i] = 4; }
      else if (i <= 15) { scoresA[i] = 5; scoresB[i] = 4; }
      else { scoresA[i] = 4; scoresB[i] = 4; }
    }
    const input: EngineInput = {
      game, holePointOverrides: [], players: [pA, pB],
      teamAssignments: teams, scores: { a: scoresA, b: scoresB }, courseHoles: holes,
    };
    const r = calcMatchPlayIndividual(input);
    expect(r.teamTotals['teamA']).toBe(10 + 1.5); // 10 wins + 3 halves
    expect(r.teamTotals['teamB']).toBe(5 + 1.5);
  });

  it('Test 6: match state early close-out 10&8', () => {
    const game = makeGame('match_play_individual');
    const holes = make18Holes();
    const scoresA: Record<number, number> = {};
    const scoresB: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) { scoresA[i] = 3; scoresB[i] = 4; }
    const input: EngineInput = {
      game, holePointOverrides: [], players: [pA, pB],
      teamAssignments: teams, scores: { a: scoresA, b: scoresB }, courseHoles: holes,
    };
    const r = calcMatchPlayIndividual(input);
    expect(r.matchState.isComplete).toBe(true);
    expect(r.matchState.leadingTeamId).toBe('teamA');
    expect(r.matchState.resultLabel).toContain('10&8');
  });
});

// ── 2. BEST BALL 2v2 ────────────────────────────────────────

describe('Best Ball 2v2', () => {
  const p1 = makePlayer('u1', 'USA1', 0);
  const p2 = makePlayer('u2', 'USA2', 0);
  const p3 = makePlayer('e1', 'EUR1', 0);
  const p4 = makePlayer('e2', 'EUR2', 0);
  const players = [p1, p2, p3, p4];
  const teams = { u1: 'USA', u2: 'USA', e1: 'EUR', e2: 'EUR' };

  it('Test 7: team with lower best ball wins', () => {
    const game = makeGame('match_play_best_ball');
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 3 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 5 },
    });
    const r = calcMatchPlayBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(1);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(0);
  });

  it('Test 8: 2nd ball tiebreaker — USA wins via 2nd ball', () => {
    const game = makeGame('match_play_best_ball', { secondBallTiebreaker: true });
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 4 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 5 },
    });
    const r = calcMatchPlayBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(1);
    expect(r.holeResults[0].resultLabel).toContain('2nd ball');
  });

  it('Test 9: 2nd ball tiebreaker — both tied → halved', () => {
    const game = makeGame('match_play_best_ball', { secondBallTiebreaker: true, halvedHoleRule: 'half_point' });
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 4 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 4 },
    });
    const r = calcMatchPlayBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(0.5);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(0.5);
  });

  it('Test 10: no tiebreaker, no_points rule → both get 0', () => {
    const game = makeGame('match_play_best_ball', { secondBallTiebreaker: false, halvedHoleRule: 'no_points' });
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 4 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 4 },
    });
    const r = calcMatchPlayBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(0);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(0);
  });

  it('Test 11: EUR best ball 3 beats USA best ball 4', () => {
    const game = makeGame('match_play_best_ball');
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 4 }, u2: { 1: 4 }, e1: { 1: 3 }, e2: { 1: 5 },
    });
    const r = calcMatchPlayBestBall(input);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(1);
    expect(r.holeResults[0].teamPoints['USA']).toBe(0);
  });
});

// ── 3. GROSS BEST BALL (Sum format) ──────────────────────────

describe('Gross Best Ball (6/6/6)', () => {
  const p1 = makePlayer('u1', 'USA1', 0);
  const p2 = makePlayer('u2', 'USA2', 0);
  const p3 = makePlayer('e1', 'EUR1', 0);
  const p4 = makePlayer('e2', 'EUR2', 0);
  const players = [p1, p2, p3, p4];
  const teams = { u1: 'USA', u2: 'USA', e1: 'EUR', e2: 'EUR' };

  it('Test 12: hole 1 (best 2) — USA sum 7 < EUR sum 8', () => {
    const game = makeGame('match_play_gross_best_ball');
    const hole = makeHole(1, 4, 1);
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 3 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 4 },
    }, hole);
    // USA best 2: 3+4=7, EUR best 2: 4+4=8
    const r = calcGrossBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(1);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(0);
  });

  it('Test 13: hole 7 (best 3) — EUR wins', () => {
    const game = makeGame('match_play_gross_best_ball');
    const hole = makeHole(7, 4, 7);
    const input = singleHoleInput(game, players, teams, {
      u1: { 7: 3 }, u2: { 7: 4 }, e1: { 7: 3 }, e2: { 7: 4 },
    }, hole);
    // With 4 players on each team we only have 2 per team, so best 3 would need ≥3 players per team
    // Let's add more players
    const p5 = makePlayer('u3', 'USA3', 0);
    const p6 = makePlayer('u4', 'USA4', 0);
    const p7 = makePlayer('e3', 'EUR3', 0);
    const p8 = makePlayer('e4', 'EUR4', 0);
    const allPlayers = [p1, p2, p5, p6, p3, p4, p7, p8];
    const allTeams = { u1: 'USA', u2: 'USA', u3: 'USA', u4: 'USA', e1: 'EUR', e2: 'EUR', e3: 'EUR', e4: 'EUR' };
    const input2: EngineInput = {
      game, holePointOverrides: [], players: allPlayers, teamAssignments: allTeams,
      scores: {
        u1: { 7: 3 }, u2: { 7: 4 }, u3: { 7: 5 }, u4: { 7: 6 },
        e1: { 7: 3 }, e2: { 7: 4 }, e3: { 7: 4 }, e4: { 7: 5 },
      },
      courseHoles: [hole],
    };
    // USA best 3: 3+4+5=12, EUR best 3: 3+4+4=11
    const r = calcGrossBestBall(input2);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(1);
    expect(r.holeResults[0].teamPoints['USA']).toBe(0);
  });

  it('Test 14: hole 13 (all 4) — USA wins 18 vs 19', () => {
    const game = makeGame('match_play_gross_best_ball');
    const hole = makeHole(13, 4, 13);
    const p5 = makePlayer('u3', 'USA3', 0);
    const p6 = makePlayer('u4', 'USA4', 0);
    const p7 = makePlayer('e3', 'EUR3', 0);
    const p8 = makePlayer('e4', 'EUR4', 0);
    const allPlayers = [p1, p2, p5, p6, p3, p4, p7, p8];
    const allTeams = { u1: 'USA', u2: 'USA', u3: 'USA', u4: 'USA', e1: 'EUR', e2: 'EUR', e3: 'EUR', e4: 'EUR' };
    const input: EngineInput = {
      game, holePointOverrides: [], players: allPlayers, teamAssignments: allTeams,
      scores: {
        u1: { 13: 3 }, u2: { 13: 4 }, u3: { 13: 5 }, u4: { 13: 6 },
        e1: { 13: 3 }, e2: { 13: 4 }, e3: { 13: 5 }, e4: { 13: 7 },
      },
      courseHoles: [hole],
    };
    // USA all 4: 3+4+5+6=18, EUR all 4: 3+4+5+7=19
    const r = calcGrossBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(1);
  });

  it('Test 15: tied sum → halved with half_point', () => {
    const game = makeGame('match_play_gross_best_ball', { halvedHoleRule: 'half_point' });
    const hole = makeHole(1, 4, 1);
    const input = singleHoleInput(game, players, teams, {
      u1: { 1: 4 }, u2: { 1: 4 }, e1: { 1: 4 }, e2: { 1: 4 },
    }, hole);
    const r = calcGrossBestBall(input);
    expect(r.holeResults[0].teamPoints['USA']).toBe(0.5);
    expect(r.holeResults[0].teamPoints['EUR']).toBe(0.5);
  });
});

// ── 4. SCRAMBLE ──────────────────────────────────────────────

describe('Scramble', () => {
  const p1 = makePlayer('a1', 'A1', 0);
  const p2 = makePlayer('a2', 'A2', 0);
  const p3 = makePlayer('b1', 'B1', 0);
  const p4 = makePlayer('b2', 'B2', 0);
  const players = [p1, p2, p3, p4];
  const teams = { a1: 'tA', a2: 'tA', b1: 'tB', b2: 'tB' };

  it('Test 16: Team A lower score wins, all Team A players get 1pt', () => {
    const game = makeGame('scramble_2');
    // In scramble, only first player per team has scores
    const input = singleHoleInput(game, players, teams, {
      a1: { 1: 4 }, a2: { 1: 99 }, b1: { 1: 5 }, b2: { 1: 99 },
    });
    const r = calcScramble(input);
    expect(r.holeResults[0].teamPoints['tA']).toBe(1);
    expect(r.playerTotals['a1']).toBe(1);
    expect(r.playerTotals['a2']).toBe(1);
  });

  it('Test 17: tied scores with half_point → all get 0.5', () => {
    const game = makeGame('scramble_2', { halvedHoleRule: 'half_point' });
    const input = singleHoleInput(game, players, teams, {
      a1: { 1: 4 }, a2: { 1: 99 }, b1: { 1: 4 }, b2: { 1: 99 },
    });
    const r = calcScramble(input);
    expect(r.holeResults[0].teamPoints['tA']).toBe(0.5);
    expect(r.playerTotals['a1']).toBe(0.5);
  });

  it('Test 18: 18-hole totals — 12 wins, 4 losses, 2 halved', () => {
    const game = makeGame('scramble_2', { halvedHoleRule: 'half_point' });
    const holes = make18Holes();
    const sA: Record<number, number> = {};
    const sA2: Record<number, number> = {};
    const sB: Record<number, number> = {};
    const sB2: Record<number, number> = {};
    for (let i = 1; i <= 18; i++) {
      sA2[i] = 99; sB2[i] = 99; // filler for non-first players
      if (i <= 12) { sA[i] = 3; sB[i] = 4; }       // A wins 12
      else if (i <= 16) { sA[i] = 5; sB[i] = 4; }   // B wins 4
      else { sA[i] = 4; sB[i] = 4; }                 // halved 2
    }
    const input: EngineInput = {
      game, holePointOverrides: [], players, teamAssignments: teams,
      scores: { a1: sA, a2: sA2, b1: sB, b2: sB2 }, courseHoles: holes,
    };
    const r = calcScramble(input);
    expect(r.teamTotals['tA']).toBe(12 + 1); // 12 wins + 2*0.5
    expect(r.teamTotals['tB']).toBe(4 + 1);
  });
});

// ── 5. TOURNAMENT SIXES — MATCH PLAY ────────────────────────

describe('Tournament Sixes — Match Play', () => {
  it('Test 19: match_play format delegates to best ball logic', () => {
    const p1 = makePlayer('u1', 'USA1', 0);
    const p2 = makePlayer('u2', 'USA2', 0);
    const p3 = makePlayer('e1', 'EUR1', 0);
    const p4 = makePlayer('e2', 'EUR2', 0);
    const players = [p1, p2, p3, p4];
    const teams = { u1: 'USA', u2: 'USA', e1: 'EUR', e2: 'EUR' };
    const game = makeGame('tournament_sixes', { sixesFormat: 'match_play' });

    // 6 holes — USA best ball wins each
    const holes = Array.from({ length: 6 }, (_, i) => makeHole(i + 1, 4, i + 1));
    const scores: Record<string, Record<number, number>> = { u1: {}, u2: {}, e1: {}, e2: {} };
    for (let i = 1; i <= 6; i++) {
      scores['u1'][i] = 3; scores['u2'][i] = 5;
      scores['e1'][i] = 4; scores['e2'][i] = 5;
    }
    const input: EngineInput = {
      game, holePointOverrides: [], players, teamAssignments: teams, scores, courseHoles: holes,
    };
    const r = calcTournamentSixes(input);
    expect(r.teamTotals['USA']).toBe(6);
    expect(r.teamTotals['EUR']).toBe(0);
  });
});

// ── 6. TOURNAMENT SIXES — SUM OF STROKES ────────────────────

describe('Tournament Sixes — Sum of Strokes', () => {
  const p1 = makePlayer('a1', 'A1', 0);
  const p2 = makePlayer('a2', 'A2', 0);
  const p3 = makePlayer('b1', 'B1', 0);
  const p4 = makePlayer('b2', 'B2', 0);
  const players = [p1, p2, p3, p4];
  const teams = { a1: 'tA', a2: 'tA', b1: 'tB', b2: 'tB' };

  function fullSixesInput(
    scoresMap: Record<string, Record<number, number>>,
    segPts: number[] = [2, 2, 4],
  ): EngineInput {
    return {
      game: makeGame('tournament_sixes', {
        sixesFormat: 'sum_of_strokes',
        sixesSegmentPoints: segPts as [number, number, number],
        halvedHoleRule: 'half_point',
      }),
      holePointOverrides: [],
      players,
      teamAssignments: teams,
      scores: scoresMap,
      courseHoles: make18Holes(),
    };
  }

  function makeAllScores(
    segScores: { a1: number; a2: number; b1: number; b2: number }[],
  ): Record<string, Record<number, number>> {
    const s: Record<string, Record<number, number>> = { a1: {}, a2: {}, b1: {}, b2: {} };
    for (let i = 0; i < 18; i++) {
      const sc = segScores[i];
      s.a1[i + 1] = sc.a1;
      s.a2[i + 1] = sc.a2;
      s.b1[i + 1] = sc.b1;
      s.b2[i + 1] = sc.b2;
    }
    return s;
  }

  // Seg 1: tA=24, tB=26 → tA wins 2pts
  // Seg 2: tA=25, tB=25 → halved, each gets 1pt
  // Seg 3: tA=24, tB=22 → tB wins 4pts
  const segScores: { a1: number; a2: number; b1: number; b2: number }[] = [];
  // Seg 1 (holes 1-6): A team total=24, B team total=26
  // Each hole: a1=2, a2=2 → team per hole=4, 6 holes=24. b1=2, b2=2.33... let's use exact
  for (let i = 0; i < 6; i++) segScores.push({ a1: 2, a2: 2, b1: 2, b2: i < 4 ? 2 : 3 }); // B total = 2*6 + 2*6 - 2*4 wait...
  // Simpler: a1 and a2 both score 2 every hole → team sum per hole = 4, 6 holes = 24
  // b1=2 every hole, b2=2 for 4 holes and 3 for 2 holes → b total = 12+8+2*3 = 12+8+6 = 26? No...
  // b1 scores 2*6=12, b2 scores: 2*4 + 3*2 = 8+6=14 → total 26. Yes!

  // Seg 2 (holes 7-12): both teams sum=25
  // a1=2*6=12, a2=2*5+3=13, total=25. b1=2*6=12, b2=2*5+3=13, total=25
  for (let i = 0; i < 6; i++) segScores.push({ a1: 2, a2: i < 5 ? 2 : 3, b1: 2, b2: i < 5 ? 2 : 3 });

  // Seg 3 (holes 13-18): tA=24, tB=22
  // a1=2*6=12, a2=2*6=12 → 24. b1=2*6=12, b2=2*4+1*2=10 → 22
  for (let i = 0; i < 6; i++) segScores.push({ a1: 2, a2: 2, b1: 2, b2: i < 4 ? 2 : 1 });

  const allScores = makeAllScores(segScores);

  it('Test 20: Segment 1 — Team A wins 2pts on hole 6', () => {
    const input = fullSixesInput(allScores);
    const r = calcTournamentSixes(input);
    const hole6 = r.holeResults.find(h => h.holeNumber === 6)!;
    expect(hole6.teamPoints['tA']).toBe(2);
    expect(hole6.teamPoints['tB']).toBe(0);
  });

  it('Test 21: Segment 2 — halved, both get 1pt', () => {
    const input = fullSixesInput(allScores);
    const r = calcTournamentSixes(input);
    const hole12 = r.holeResults.find(h => h.holeNumber === 12)!;
    expect(hole12.teamPoints['tA']).toBe(1);
    expect(hole12.teamPoints['tB']).toBe(1);
  });

  it('Test 22: Segment 3 — Team B wins 4pts on hole 18', () => {
    const input = fullSixesInput(allScores);
    const r = calcTournamentSixes(input);
    const hole18 = r.holeResults.find(h => h.holeNumber === 18)!;
    expect(hole18.teamPoints['tB']).toBe(4);
    expect(hole18.teamPoints['tA']).toBe(0);
  });

  it('Test 23: all 3 segments → teamTotals correct', () => {
    const input = fullSixesInput(allScores);
    const r = calcTournamentSixes(input);
    expect(r.teamTotals['tA']).toBe(2 + 1); // seg1 win + seg2 half
    expect(r.teamTotals['tB']).toBe(0 + 1 + 4); // seg2 half + seg3 win
  });
});

// ── 7. HANDICAP CALCULATIONS ────────────────────────────────

describe('Handicap Calculations', () => {
  it('Test 24: handicap 18, hole index 1 → 1 stroke', () => {
    expect(strokesReceived(18, 1)).toBe(1);
  });

  it('Test 25: handicap 18, hole index 18 → 1 stroke', () => {
    expect(strokesReceived(18, 18)).toBe(1);
  });

  it('Test 26: handicap 19, hole index 1 → 2 strokes', () => {
    expect(strokesReceived(19, 1)).toBe(2);
  });

  it('Test 27: handicap 0 → 0 strokes on any hole', () => {
    expect(strokesReceived(0, 1)).toBe(0);
    expect(strokesReceived(0, 18)).toBe(0);
  });

  it('Test 28: match play difference — A=16, B=10, diff=6, strokes on holes 1-6 only', () => {
    const pA = makePlayer('a', 'A', 16);
    const pB = makePlayer('b', 'B', 10);
    const game = makeGame('match_play_individual', { useHandicaps: true });

    for (let hIdx = 1; hIdx <= 18; hIdx++) {
      const sd = matchPlayStrokeDifference([pA, pB], game, hIdx);
      // Player A has higher handicap → gets strokes. Diff = 6.
      // Player A gets 1 stroke on holes with index ≤ 6, 0 otherwise
      if (hIdx <= 6) {
        expect(sd['a']).toBe(1);
      } else {
        expect(sd['a']).toBe(0);
      }
      expect(sd['b']).toBe(0); // lower handicap player always 0
    }
  });
});

// ── 8. MAX SCORE PER HOLE ───────────────────────────────────

describe('Max Score Per Hole', () => {
  it('Test 29: maxScorePerHole=4, par=4, score 10 → capped at 8', () => {
    const pA = makePlayer('a', 'A', 0);
    const pB = makePlayer('b', 'B', 0);
    const teams = { a: 'tA', b: 'tB' };
    const game = makeGame('match_play_individual', { maxScorePerHole: 4 });
    const hole = makeHole(1, 4, 1);
    const input = singleHoleInput(game, [pA, pB], teams, {
      a: { 1: 10 }, b: { 1: 4 },
    }, hole);
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].grossScores['a']).toBe(8); // par 4 + max 4
  });

  it('Test 30: maxScorePerHole=null → no cap', () => {
    const pA = makePlayer('a', 'A', 0);
    const pB = makePlayer('b', 'B', 0);
    const teams = { a: 'tA', b: 'tB' };
    const game = makeGame('match_play_individual', { maxScorePerHole: null });
    const hole = makeHole(1, 4, 1);
    const input = singleHoleInput(game, [pA, pB], teams, {
      a: { 1: 10 }, b: { 1: 4 },
    }, hole);
    const r = calcMatchPlayIndividual(input);
    expect(r.holeResults[0].grossScores['a']).toBe(10);
  });
});

// ── 9. MATCH STATE ──────────────────────────────────────────

describe('Match State', () => {
  function makeHR(teamAPoints: number, teamBPoints: number): HoleResult {
    return {
      holeNumber: 0,
      teamPoints: { tA: teamAPoints, tB: teamBPoints },
      playerPoints: {},
      pointsValue: 1,
      resultLabel: '',
      grossScores: {},
      netScores: {},
    };
  }

  it('Test 31: 3-1 after 4 holes → 2 UP — Thru 4', () => {
    const hrs = [makeHR(1, 0), makeHR(1, 0), makeHR(1, 0), makeHR(0, 1)];
    const ms = calcMatchState(hrs, 'tA', 'tB', 18);
    expect(ms.isComplete).toBe(false);
    expect(ms.isDormie).toBe(false);
    expect(ms.resultLabel).toBe('2 UP — Thru 4');
  });

  it('Test 32: 5-1 after 14 holes, 4 remaining → dormie', () => {
    const hrs: HoleResult[] = [];
    for (let i = 0; i < 5; i++) hrs.push(makeHR(1, 0));
    for (let i = 0; i < 1; i++) hrs.push(makeHR(0, 1));
    for (let i = 0; i < 8; i++) hrs.push(makeHR(0, 0));
    const ms = calcMatchState(hrs, 'tA', 'tB', 18);
    expect(ms.isDormie).toBe(true);
    expect(ms.isComplete).toBe(false);
  });

  it('Test 33: 6-1 after 14 holes → complete (lead > remaining)', () => {
    const hrs: HoleResult[] = [];
    for (let i = 0; i < 6; i++) hrs.push(makeHR(1, 0));
    for (let i = 0; i < 1; i++) hrs.push(makeHR(0, 1));
    for (let i = 0; i < 7; i++) hrs.push(makeHR(0, 0));
    const ms = calcMatchState(hrs, 'tA', 'tB', 18);
    expect(ms.isComplete).toBe(true);
    expect(ms.resultLabel).toContain('5&4');
  });

  it('Test 34: 0 holes played → All Square', () => {
    const ms = calcMatchState([], 'tA', 'tB', 18);
    expect(ms.resultLabel).toBe('All Square');
  });

  it('Test 35: all 18 holes played, tied → Halved', () => {
    const hrs: HoleResult[] = [];
    for (let i = 0; i < 9; i++) hrs.push(makeHR(1, 0));
    for (let i = 0; i < 9; i++) hrs.push(makeHR(0, 1));
    const ms = calcMatchState(hrs, 'tA', 'tB', 18);
    expect(ms.isComplete).toBe(true);
    expect(ms.resultLabel).toBe('Halved');
  });
});
