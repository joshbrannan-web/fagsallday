// Helpers for translating between physical hole numbers (1-18, what's on the scorecard)
// and play-order positions (1-18, where in the round it falls).
//
// When a round starts on hole 10, the first played hole is physical 10 (play order 1),
// and physical hole 9 is played last (play order 18). All game segments/stretches/
// fixed-hole triggers should key off play-order position, not physical hole number.

export const TOTAL_HOLES = 18;

/** 1-indexed play-order position of a physical hole given the round's starting hole. */
export const getPlayOrder = (hole: number, startHole: number = 1): number => {
  const s = normalizeStart(startHole);
  return ((hole - s + TOTAL_HOLES) % TOTAL_HOLES) + 1;
};

/** Physical hole number at a given 1-indexed play-order position. */
export const getHoleByPlayOrder = (order: number, startHole: number = 1): number => {
  const s = normalizeStart(startHole);
  const zeroIdx = ((s - 1) + (order - 1)) % TOTAL_HOLES;
  return zeroIdx + 1;
};

/** Ordered array of the 18 physical hole numbers, in play order. */
export const getPlayedHoles = (startHole: number = 1): number[] => {
  return Array.from({ length: TOTAL_HOLES }, (_, i) => getHoleByPlayOrder(i + 1, startHole));
};

/** Physical hole numbers for the first-played 9 (aka "Front" for game purposes). */
export const getFrontNineHoles = (startHole: number = 1): number[] => {
  return getPlayedHoles(startHole).slice(0, 9);
};

/** Physical hole numbers for the second-played 9 (aka "Back" for game purposes). */
export const getBackNineHoles = (startHole: number = 1): number[] => {
  return getPlayedHoles(startHole).slice(9, 18);
};

/** True if hole falls within the last N holes played (e.g. last 3 for Bloody Banker). */
export const isInLastNPlayed = (hole: number, startHole: number = 1, n: number = 3): boolean => {
  const pos = getPlayOrder(hole, startHole);
  return pos > TOTAL_HOLES - n;
};

/** True if this hole is the first played hole of a segment of given length starting at play-order 1. */
export const isSegmentStartPlayOrder = (hole: number, startHole: number, segmentLength: number): boolean => {
  const pos = getPlayOrder(hole, startHole);
  return ((pos - 1) % segmentLength) === 0;
};

/** Which "front"/"back" a hole belongs to based on play order. */
export const getPlayHalf = (hole: number, startHole: number = 1): 'front' | 'back' => {
  return getPlayOrder(hole, startHole) <= 9 ? 'front' : 'back';
};

/** Next physical hole in play order (wraps around 18 holes). */
export const getNextHole = (hole: number, startHole: number = 1): number => {
  const pos = getPlayOrder(hole, startHole);
  const nextPos = pos >= TOTAL_HOLES ? TOTAL_HOLES : pos + 1;
  return getHoleByPlayOrder(nextPos, startHole);
};

/** Previous physical hole in play order (clamps at first). */
export const getPrevHole = (hole: number, startHole: number = 1): number => {
  const pos = getPlayOrder(hole, startHole);
  const prevPos = pos <= 1 ? 1 : pos - 1;
  return getHoleByPlayOrder(prevPos, startHole);
};

function normalizeStart(s: number): number {
  if (!Number.isFinite(s)) return 1;
  const clamped = Math.max(1, Math.min(TOTAL_HOLES, Math.floor(s)));
  return clamped;
}
