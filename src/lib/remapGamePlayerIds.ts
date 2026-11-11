import type { GameSettings } from '@/types';

/**
 * Tournament side games are configured with tournament player IDs, but the
 * round roster uses local IDs ("1","2",...). Deep-replace any string that
 * matches a tournament player ID with the round player ID.
 * `mapping` is roundPlayerId -> tournamentPlayerId (the _TOURNAMENT_META shape).
 */
export const remapGamePlayerIds = (
  games: GameSettings[] | null | undefined,
  mapping: Record<string, string> | null | undefined,
): GameSettings[] => {
  if (!games || !mapping) return games || [];
  const reverse: Record<string, string> = {};
  for (const [roundId, tpId] of Object.entries(mapping)) if (tpId) reverse[tpId] = roundId;
  if (Object.keys(reverse).length === 0) return games;
  const walk = (v: any): any => {
    if (typeof v === 'string') return reverse[v] ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) out[reverse[k] ?? k] = walk(val);
      return out;
    }
    return v;
  };
  return games.map(g => ({ ...g, config: walk(g.config) }));
};
