import { describe, it, expect } from 'vitest';
import { calculateWolf } from './gameEngine';
import { GameType, Round, GameSettings, Player, Course } from '../types';

const course: Course = {
  id: 'c1',
  name: 'Test',
  location: '',
  holes: Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    handicapIndex: i + 1,
    yardage: 400,
  })),
};

const makePlayers = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    handicapIndex: 0,
    courseHandicap: 0,
    tee: 'White',
  }));

const game: GameSettings = {
  id: 'g1',
  type: GameType.WOLF,
  name: 'Wolf',
  unitStake: 1,
  config: { useHandicaps: false, handicapMode: 'relative', wolf: { teesFirst: true } },
} as GameSettings;

const makeRound = (players: Player[], scores: Record<string, number>, wolfData: any): Round => ({
  id: 'r1',
  course,
  players,
  games: [game],
  scores: { 1: scores },
  gameData: { g1: { 1: { _WOLF_DATA: wolfData } } },
  status: 'ACTIVE',
  startTime: Date.now(),
});

const sum = (results: Record<string, number>) =>
  Math.round(Object.values(results).reduce((a, b) => a + b, 0) * 100) / 100;

describe('calculateWolf with 4-8 players', () => {
  it('rejects fewer than 4 or more than 8 players', () => {
    const r = makeRound(makePlayers(3), { p1: 4, p2: 4, p3: 4 }, null);
    expect(calculateWolf(r, game).details[0]).toContain('4 to 8');
  });

  it('6 players: Wolf + partner win, hole nets to zero', () => {
    const players = makePlayers(6);
    const scores: Record<string, number> = { p1: 3, p2: 4, p3: 5, p4: 5, p5: 5, p6: 5 };
    const r = makeRound(players, scores, {
      wolfId: 'p1', partnerId: 'p2', isLoneWolf: false, isBlindLoneWolf: false, confirmed: true,
    });
    const res = calculateWolf(r, game).playerResults;
    // 4 opponents pay 2 each = 8, split between wolf + partner = 4 each
    expect(res.p1).toBe(4);
    expect(res.p2).toBe(4);
    expect(res.p3).toBe(-2);
    expect(sum(res)).toBe(0);
  });

  it('8 players: Blind Lone Wolf win pays 4 from each of 7', () => {
    const players = makePlayers(8);
    const scores: Record<string, number> = { p1: 3, p2: 4, p3: 4, p4: 4, p5: 4, p6: 4, p7: 4, p8: 4 };
    const r = makeRound(players, scores, {
      wolfId: 'p1', isLoneWolf: true, isBlindLoneWolf: true, confirmed: true,
    });
    const res = calculateWolf(r, game).playerResults;
    expect(res.p1).toBe(28);
    expect(res.p8).toBe(-4);
    expect(sum(res)).toBe(0);
  });

  it('8 players: Wolf + partner lose, opponents win 3 each', () => {
    const players = makePlayers(8);
    const scores: Record<string, number> = { p1: 5, p2: 5, p3: 3, p4: 4, p5: 4, p6: 4, p7: 4, p8: 4 };
    const r = makeRound(players, scores, {
      wolfId: 'p1', partnerId: 'p2', isLoneWolf: false, isBlindLoneWolf: false, confirmed: true,
    });
    const res = calculateWolf(r, game).playerResults;
    expect(res.p3).toBe(3);
    expect(res.p1).toBe(-9);
    expect(res.p2).toBe(-9);
    expect(sum(res)).toBe(0);
  });

  it('ties push', () => {
    const players = makePlayers(5);
    const scores: Record<string, number> = { p1: 4, p2: 4, p3: 4, p4: 4, p5: 4 };
    const r = makeRound(players, scores, {
      wolfId: 'p1', partnerId: 'p2', isLoneWolf: false, isBlindLoneWolf: false, confirmed: true,
    });
    const res = calculateWolf(r, game).playerResults;
    expect(sum(res)).toBe(0);
    expect(res.p1).toBe(0);
  });
});
