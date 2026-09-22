import type { TournamentGame, TournamentPlayer } from '@/types/tournament';
import {
  calcCourseHandicap,
  getEffectiveHandicap,
  strokesReceived,
} from '@/services/tournamentEngine';

export interface MatchupStrokeInfo {
  /** Course handicap per player id (allowance applied). */
  courseHandicaps: Record<string, number>;
  /** Total strokes each player receives over 18 holes, relative to the low handicap in the matchup. */
  strokesGiven: Record<string, number>;
  /** Player id receiving strokes, when exactly one player does. */
  receiverId: string | null;
  /** Number of strokes the receiver gets. 0 when nobody gets strokes. */
  receiverStrokes: number;
  /** Handicaps are switched off for this game. */
  enabled: boolean;
}

const EMPTY: MatchupStrokeInfo = {
  courseHandicaps: {},
  strokesGiven: {},
  receiverId: null,
  receiverStrokes: 0,
  enabled: false,
};

/**
 * Strokes for a set of players relative to the lowest course handicap among them.
 * Mirrors matchPlayStrokeDifference in the engine, but returns totals (not per-hole).
 */
export function matchupStrokeInfo(
  players: (TournamentPlayer | undefined)[],
  game?: TournamentGame | null,
): MatchupStrokeInfo {
  const list = players.filter((p): p is TournamentPlayer => !!p);
  if (!game?.useHandicaps || list.length === 0) return EMPTY;

  const allowance = (game.handicapAllowancePercent ?? 100) / 100;
  const courseHandicaps: Record<string, number> = {};
  list.forEach(p => {
    courseHandicaps[p.id] = calcCourseHandicap(getEffectiveHandicap(p) * allowance);
  });

  const low = Math.min(...Object.values(courseHandicaps));
  const strokesGiven: Record<string, number> = {};
  Object.entries(courseHandicaps).forEach(([id, ch]) => {
    strokesGiven[id] = Math.max(0, ch - low);
  });

  const receivers = Object.entries(strokesGiven).filter(([, s]) => s > 0);
  const single = receivers.length === 1 ? receivers[0] : null;

  return {
    courseHandicaps,
    strokesGiven,
    receiverId: single ? single[0] : null,
    receiverStrokes: single ? single[1] : 0,
    enabled: true,
  };
}

/** Strokes a player receives on one hole given their total allowance and the hole's stroke index. */
export function strokesOnHole(totalStrokes: number, holeHandicapIndex: number): number {
  return strokesReceived(totalStrokes, holeHandicapIndex);
}

/** Map holeNumber -> stroke index for quick lookups in display components. */
export function buildStrokeIndexMap(
  courseHoles: { number: number; handicapIndex: number }[],
): Record<number, number> {
  const map: Record<number, number> = {};
  courseHoles.forEach(h => { map[h.number] = h.handicapIndex; });
  return map;
}

/** Short label like "Josh gets 4" or "Scratch — no strokes". */
export function strokeSummaryLabel(
  info: MatchupStrokeInfo,
  nameFor: (playerId: string) => string,
): string | null {
  if (!info.enabled) return 'No handicaps';
  if (!info.receiverId || info.receiverStrokes === 0) return 'No strokes — even handicaps';
  const s = info.receiverStrokes;
  return `${nameFor(info.receiverId)} gets ${s} stroke${s === 1 ? '' : 's'}`;
}
