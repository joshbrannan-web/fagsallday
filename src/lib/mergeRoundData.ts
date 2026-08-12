/**
 * Merge helpers for round score / game-data blobs.
 *
 * Whole-blob writes are dangerous: a client holding a stale snapshot can wipe
 * holes that were recorded elsewhere (or later) by simply writing its own copy.
 * These helpers merge a local snapshot into the authoritative server blob so a
 * write can only add or overwrite the holes the local client actually knows
 * about — never remove holes it never saw.
 */

export type ScoresBlob = Record<string, Record<string, number>>;
export type GameDataBlob = Record<string, any>;

export const mergeScores = (server: any, local: any): ScoresBlob => {
  const out: ScoresBlob = { ...((server as ScoresBlob) || {}) };
  const src = (local as ScoresBlob) || {};
  for (const hole of Object.keys(src)) {
    out[hole] = { ...(out[hole] || {}), ...(src[hole] || {}) };
  }
  return out;
};

export const mergeGameData = (server: any, local: any): GameDataBlob => {
  const out: GameDataBlob = { ...((server as GameDataBlob) || {}) };
  const src = (local as GameDataBlob) || {};
  for (const gameId of Object.keys(src)) {
    const serverGame = out[gameId] || {};
    const localGame = src[gameId] || {};

    // Meta buckets are flat objects, not hole-keyed
    if (gameId.startsWith('_')) {
      out[gameId] = { ...serverGame, ...localGame };
      continue;
    }

    const mergedGame: Record<string, any> = { ...serverGame };
    for (const hole of Object.keys(localGame)) {
      const sh = serverGame[hole];
      const lh = localGame[hole];
      mergedGame[hole] =
        sh && typeof sh === 'object' && !Array.isArray(sh) &&
        lh && typeof lh === 'object' && !Array.isArray(lh)
          ? { ...sh, ...lh }
          : lh;
    }
    out[gameId] = mergedGame;
  }
  return out;
};

/** Number of holes that have at least one recorded score */
export const countScoredHoles = (scores: any): number =>
  Object.keys((scores as ScoresBlob) || {}).filter(
    (h) => Object.keys(((scores as ScoresBlob)[h]) || {}).length > 0
  ).length;

/**
 * Fill holes/players missing from `primary` using `secondary` (the local cache).
 * `primary` always wins on conflict — this can only ADD cells, never change one.
 */
export const fillScoreGaps = (primary: any, secondary: any): ScoresBlob => {
  const out: ScoresBlob = { ...((primary as ScoresBlob) || {}) };
  const src = (secondary as ScoresBlob) || {};
  for (const hole of Object.keys(src)) {
    out[hole] = { ...(src[hole] || {}), ...(out[hole] || {}) };
  }
  return out;
};

/** Same idea for the game-data blob (bets, dots, presses, meta buckets). */
export const fillGameDataGaps = (primary: any, secondary: any): GameDataBlob => {
  const out: GameDataBlob = { ...((primary as GameDataBlob) || {}) };
  const src = (secondary as GameDataBlob) || {};
  for (const gameId of Object.keys(src)) {
    const p = out[gameId];
    const s = src[gameId] || {};
    if (p === undefined) { out[gameId] = s; continue; }
    if (!p || typeof p !== 'object' || Array.isArray(p) || typeof s !== 'object' || Array.isArray(s)) continue;
    const merged: Record<string, any> = { ...s };
    for (const key of Object.keys(p)) {
      const pv = (p as any)[key];
      const sv = (s as any)[key];
      merged[key] =
        pv && typeof pv === 'object' && !Array.isArray(pv) &&
        sv && typeof sv === 'object' && !Array.isArray(sv)
          ? { ...sv, ...pv }
          : pv;
    }
    out[gameId] = merged;
  }
  return out;
};
