import type { SubMatchup, MatchupMode } from '@/types/tournament';

export const FRONT_LABEL = 'Holes 1–9';
export const BACK_LABEL = 'Holes 10–18';

/**
 * Reads the 1v1 matchups out of a group's stored `team_matchup` JSONB.
 *
 * Supports both shapes:
 *  - legacy: { subMatchups: [{ playerA, playerB }] }  → applies to all 18 holes
 *  - split:  { matchupMode: 'split_9s', frontMatchups, backMatchups }
 *            → flattened into hole-ranged matchups (1-9 and 10-18)
 */
export function resolveSubMatchups(teamMatchup: any): SubMatchup[] | undefined {
  if (!teamMatchup) return undefined;

  const mode: MatchupMode | undefined = teamMatchup.matchupMode;
  if (mode === 'split_9s') {
    const front: SubMatchup[] = Array.isArray(teamMatchup.frontMatchups) ? teamMatchup.frontMatchups : [];
    const back: SubMatchup[] = Array.isArray(teamMatchup.backMatchups) ? teamMatchup.backMatchups : [];
    const flat = [
      ...front.map(m => ({ ...m, holeStart: 1, holeEnd: 9, label: m.label || FRONT_LABEL })),
      ...back.map(m => ({ ...m, holeStart: 10, holeEnd: 18, label: m.label || BACK_LABEL })),
    ];
    if (flat.length > 0) return flat;
  }

  if (Array.isArray(teamMatchup.subMatchups) && teamMatchup.subMatchups.length > 0) {
    return teamMatchup.subMatchups as SubMatchup[];
  }
  return undefined;
}

/** Builds the stored matchup payload for split-9s mode. */
export function buildSplitMatchupPayload(front: SubMatchup[], back: SubMatchup[]) {
  return {
    matchupMode: 'split_9s' as MatchupMode,
    frontMatchups: front.map(m => ({ ...m, holeStart: 1, holeEnd: 9, label: FRONT_LABEL })),
    backMatchups: back.map(m => ({ ...m, holeStart: 10, holeEnd: 18, label: BACK_LABEL })),
    // kept flat as well so older screens still render something sensible
    subMatchups: [
      ...front.map(m => ({ ...m, holeStart: 1, holeEnd: 9, label: FRONT_LABEL })),
      ...back.map(m => ({ ...m, holeStart: 10, holeEnd: 18, label: BACK_LABEL })),
    ],
  };
}

/** True when a matchup only covers part of the round. */
export function matchupCoversHole(m: SubMatchup, hole: number): boolean {
  return (m.holeStart === undefined || hole >= m.holeStart)
    && (m.holeEnd === undefined || hole <= m.holeEnd);
}
