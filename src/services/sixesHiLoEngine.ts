import { Round, GameSettings, GameResult } from "../types";
import { calculateGameStrokes, getGamePlayers } from "./gameEngine";
import { getPlayedHoles } from "../lib/holeOrder";

// Sixes Low Ball / High Ball (a.k.a. Hollywood Hi-Lo)
// Players A,B,C,D (game player order). Partners rotate every 6 played holes:
//   1-6: A+B vs C+D   7-12: A+C vs B+D   13-18: A+D vs B+C
// Each hole: 1 pt for better low ball, 1 pt for better high ball. Ties carry (skins-style).

export interface HiLoHoleResult {
  hole: number;
  stretch: number;
  teamA: string[];
  teamB: string[];
  lowWinner: 'A' | 'B' | 'push';
  highWinner: 'A' | 'B' | 'push';
  lowPts: number;  // points in play for low ball this hole (1 + carries)
  highPts: number;
  pointsA: number;
  pointsB: number;
  lowCarryAfter: number;
  highCarryAfter: number;
}

export const getHiLoTeams = (ids: string[], stretch: number): { teamA: string[]; teamB: string[] } => {
  const [a, b, c, d] = ids;
  if (stretch === 1) return { teamA: [a, b], teamB: [c, d] };
  if (stretch === 2) return { teamA: [a, c], teamB: [b, d] };
  return { teamA: [a, d], teamB: [b, c] };
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export const calculateSixesHiLoHoles = (round: Round, game: GameSettings): HiLoHoleResult[] => {
  const players = getGamePlayers(game, round);
  if (players.length !== 4) return [];
  const ids = players.map(p => p.id);
  const resetOnRotation = game.config.sixesHiLo?.resetCarriesOnRotation ?? true;
  const startHole = (round as any).startHole || 1;
  const holeCount = round.course.holes.length;
  const order = getPlayedHoles(startHole).filter(h => h <= holeCount);

  // Reference for relative strokes: lowest handicap among the 4 game players
  const ref = players.reduce((m, p) => (p.courseHandicap < m.courseHandicap ? p : m), players[0]);

  let lowCarry = 0;
  let highCarry = 0;
  let lastStretch = 1;
  const out: HiLoHoleResult[] = [];

  for (let i = 0; i < order.length; i++) {
    const h = order[i];
    const stretch = Math.min(3, Math.floor(i / 6) + 1);
    if (stretch !== lastStretch) {
      if (resetOnRotation) { lowCarry = 0; highCarry = 0; }
      lastStretch = stretch;
    }
    const hs = round.scores?.[h];
    if (!hs || !ids.every(id => typeof hs[id] === 'number' && (hs[id] as number) > 0)) break;

    const net = (id: string) => (hs[id] as number) - calculateGameStrokes(round, game, h, id, ref.id);
    const { teamA, teamB } = getHiLoTeams(ids, stretch);
    const a = teamA.map(net).sort((x, y) => x - y);
    const b = teamB.map(net).sort((x, y) => x - y);

    const lowPts = 1 + lowCarry;
    const highPts = 1 + highCarry;
    const lowWinner = a[0] < b[0] ? 'A' : a[0] > b[0] ? 'B' : 'push';
    const highWinner = a[1] < b[1] ? 'A' : a[1] > b[1] ? 'B' : 'push';

    let pointsA = 0, pointsB = 0;
    if (lowWinner === 'push') lowCarry += 1; else { lowWinner === 'A' ? (pointsA += lowPts) : (pointsB += lowPts); lowCarry = 0; }
    if (highWinner === 'push') highCarry += 1; else { highWinner === 'A' ? (pointsA += highPts) : (pointsB += highPts); highCarry = 0; }

    out.push({ hole: h, stretch, teamA, teamB, lowWinner, highWinner, lowPts, highPts, pointsA, pointsB, lowCarryAfter: lowCarry, highCarryAfter: highCarry });
  }
  return out;
};

export const calculateSixesHiLo = (round: Round, game: GameSettings): GameResult => {
  const players = getGamePlayers(game, round);
  const results: { [id: string]: number } = {};
  const holeResults: { [hole: number]: { [id: string]: number } } = {};
  const details: string[] = [];
  players.forEach(p => (results[p.id] = 0));
  if (players.length !== 4) {
    return { gameId: game.id, playerResults: results, details: ["Sixes Hi-Lo requires exactly 4 players"] };
  }
  const name = (id: string) => players.find(p => p.id === id)?.name ?? id;
  const unit = game.unitStake;
  const payoutMode = game.config.sixesHiLo?.payoutMode ?? 'cumulative';
  const holes = calculateSixesHiLoHoles(round, game);
  const holeCount = round.course.holes.length;
  const perStretch = Math.min(6, Math.ceil(holeCount / 3));

  for (const hr of holes) {
    holeResults[hr.hole] = {};
    players.forEach(p => (holeResults[hr.hole][p.id] = 0));
    const diff = hr.pointsA - hr.pointsB;
    if (payoutMode === 'cumulative' && diff !== 0) {
      hr.teamA.forEach(id => { holeResults[hr.hole][id] = r2(diff * unit); });
      hr.teamB.forEach(id => { holeResults[hr.hole][id] = r2(-diff * unit); });
    }
    const lo = hr.lowWinner === 'push' ? 'Low pushed' : `Low → ${hr.lowWinner === 'A' ? 'Team A' : 'Team B'} (${hr.lowPts})`;
    const hi = hr.highWinner === 'push' ? 'High pushed' : `High → ${hr.highWinner === 'A' ? 'Team A' : 'Team B'} (${hr.highPts})`;
    details.push(`Hole ${hr.hole}: ${lo}, ${hi}`);
  }

  for (let s = 1; s <= 3; s++) {
    const sh = holes.filter(h => h.stretch === s);
    if (!sh.length) continue;
    const { teamA, teamB } = sh[0];
    const pa = sh.reduce((t, h) => t + h.pointsA, 0);
    const pb = sh.reduce((t, h) => t + h.pointsB, 0);
    const label = `${teamA.map(name).join(' & ')} vs ${teamB.map(name).join(' & ')}`;
    if (payoutMode === 'cumulative') {
      const d = pa - pb;
      teamA.forEach(id => (results[id] += d * unit));
      teamB.forEach(id => (results[id] -= d * unit));
      details.push(`Stretch ${s} (${label}): ${pa}–${pb}`);
    } else {
      const complete = sh.length >= perStretch;
      if (complete && pa !== pb) {
        const win = pa > pb ? teamA : teamB;
        const lose = pa > pb ? teamB : teamA;
        win.forEach(id => (results[id] += unit));
        lose.forEach(id => (results[id] -= unit));
      }
      details.push(`Stretch ${s} (${label}): ${pa}–${pb}${complete ? (pa === pb ? ' — push' : '') : ' — in progress'}`);
    }
  }
  Object.keys(results).forEach(k => (results[k] = r2(results[k])));
  return { gameId: game.id, playerResults: results, details, holeResults };
};
