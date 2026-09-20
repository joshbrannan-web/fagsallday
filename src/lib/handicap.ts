/**
 * Handicap index helpers.
 *
 * Golf displays "plus" (better than scratch) handicaps with a leading "+",
 * e.g. "+2.4". Internally we always store them as negative numbers (-2.4),
 * which is what every scoring engine expects.
 */

/** Parse user/GHIN text into a numeric index. "+2.4" -> -2.4, "2.4" -> 2.4. */
export const parseHandicapInput = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const raw = value.trim();
  if (!raw) return null;

  const isPlus = raw.startsWith('+');
  const parsed = parseFloat(isPlus ? raw.slice(1) : raw);
  if (isNaN(parsed)) return null;

  return isPlus ? -Math.abs(parsed) : parsed;
};

/** Format a numeric index for display. -2.4 -> "+2.4", 8.1 -> "8.1". */
export const formatHandicap = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || isNaN(value)) return '';
  if (value < 0) return `+${Math.abs(value).toFixed(digits)}`;
  return value.toFixed(digits);
};
