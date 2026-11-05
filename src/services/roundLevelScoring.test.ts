import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake database client that records every request (table + chained operations)
// and answers from `state.respond`.
const state = vi.hoisted(() => ({
  calls: [] as { table: string; ops: string[]; args: unknown[][] }[],
  respond: (() => ({ data: null, error: null })) as (table: string, ops: string[], args: unknown[][]) => { data: unknown; error: unknown },
  engine: null as null | (() => unknown),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string) => {
    const ops: string[] = [];
    const args: unknown[][] = [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'abortSignal', 'maybeSingle', 'upsert', 'delete', 'insert', 'update']) {
      b[m] = (...a: unknown[]) => { ops.push(m); args.push(a); return b; };
    }
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      state.calls.push({ table, ops: [...ops], args: [...args] });
      return Promise.resolve(state.respond(table, ops, args)).then(resolve, reject);
    };
    return b;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

vi.mock('@/services/tournamentEngine', () => ({
  calcTournamentHoleResults: () => {
    if (state.engine) return state.engine();
    return {
      holeResults: [1, 2].map(h => ({ holeNumber: h, teamPoints: {}, playerPoints: {}, pointsValue: 1, resultLabel: 'A wins' })),
    };
  },
}));

import {
  findHolesMissingResults, planResultRewrite, recalcRoundLevelResults, recalcRoundMatchResults, ResultsCalculationError,
} from './roundLevelScoring';
import { SubmitError } from './retry';

const ok = (data: unknown) => ({ data, error: null });
const refused = { data: null, error: { message: 'permission denied', code: '42501' } };
const scores = [
  { tournament_player_id: 'p1', hole_number: 1, gross_score: 4 },
  { tournament_player_id: 'p2', hole_number: 1, gross_score: 5 },
];

/** A healthy round: two groups, one player per team, configurable overrides per table. */
function roundData(overrides: Record<string, (ops: string[]) => { data: unknown; error: unknown } | undefined> = {}) {
  return (table: string, ops: string[]) => {
    const custom = overrides[table]?.(ops);
    if (custom) return custom;
    switch (table) {
      case 'tournament_rounds': return ok({ id: 'r1', tournament_id: 't1', course_data: { holes: [{ par: 4 }, { par: 4 }] } });
      case 'tournament_games': return ok({ id: 'game1', tournament_round_id: 'r1', game_type: 'match_play_gross_best_ball' });
      case 'tournament_groups': return ok([{ id: 'grpA', group_number: 1 }, { id: 'grpB', group_number: 2 }]);
      case 'tournament_group_players': return ok([{ tournament_player_id: 'p1', team_id: 'tA' }, { tournament_player_id: 'p2', team_id: 'tB' }]);
      case 'tournament_players': return ok([
        { id: 'p1', tournament_id: 't1', display_name: 'One', handicap_index: 0 },
        { id: 'p2', tournament_id: 't1', display_name: 'Two', handicap_index: 0 },
      ]);
      case 'tournament_hole_scores': return ok(scores);
      case 'tournament_round_matches': return ok([{ id: 'm1', tournament_round_id: 'r1', match_number: 1, side_a: ['p1'], side_b: ['p2'] }]);
      case 'tournament_hole_results':
        if (ops.includes('upsert')) return ok([{ id: 'x' }, { id: 'y' }]);
        if (ops.includes('delete')) return ok(null);
        return ok([]); // existing rows
      default: return ok([]);
    }
  };
}

const writes = () => state.calls.filter(c => c.table === 'tournament_hole_results' && (c.ops.includes('upsert') || c.ops.includes('delete') || c.ops.includes('insert')));
const deletes = () => state.calls.filter(c => c.table === 'tournament_hole_results' && c.ops.includes('delete'));

beforeEach(() => {
  state.calls = [];
  state.engine = null;
  state.respond = roundData();
});

describe('a failed read never leads to deleting results (whole-round formats)', () => {
  it('stops before saving or deleting anything when the scores read is refused', async () => {
    state.respond = roundData({ tournament_hole_scores: () => refused });
    await expect(recalcRoundLevelResults('r1')).rejects.toBeInstanceOf(SubmitError);
    expect(writes()).toEqual([]);
  });

  it('stops before saving or deleting anything when the scores read loses its connection', async () => {
    state.respond = roundData({ tournament_hole_scores: () => ({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }) });
    // A short budget so the test doesn't wait for every retry
    await expect(recalcRoundLevelResults('r1', { deadline: Date.now() + 1_500 })).rejects.toMatchObject({ kind: 'connection' });
    expect(writes()).toEqual([]);
  });

  it('stops when any other read fails, e.g. the per-hole points settings', async () => {
    state.respond = roundData({ tournament_hole_points: () => refused });
    await expect(recalcRoundLevelResults('r1')).rejects.toBeInstanceOf(SubmitError);
    expect(writes()).toEqual([]);
  });

  it('leaves saved results alone when the scores read succeeds but returns nothing', async () => {
    state.respond = roundData({ tournament_hole_scores: () => ok([]) });
    await expect(recalcRoundLevelResults('r1')).resolves.toBeNull();
    expect(writes()).toEqual([]);
  });
});

describe('whole-round formats save before they delete', () => {
  it('saves the new results first, then removes stale and duplicate rows', async () => {
    await recalcRoundLevelResults('r1');
    const ops = writes().map(c => (c.ops.includes('upsert') ? 'save' : 'delete'));
    expect(ops[0]).toBe('save');
    expect(ops.slice(1).every(op => op === 'delete')).toBe(true);
  });

  it('deletes nothing if the save fails', async () => {
    state.respond = roundData({ tournament_hole_results: ops => (ops.includes('upsert') ? refused : undefined) });
    await expect(recalcRoundLevelResults('r1')).rejects.toBeInstanceOf(SubmitError);
    expect(deletes()).toEqual([]);
  });

  it('reports a save the database only partly accepted', async () => {
    state.respond = roundData({ tournament_hole_results: ops => (ops.includes('upsert') ? ok([{ id: 'x' }]) : undefined) });
    await expect(recalcRoundLevelResults('r1')).rejects.toMatchObject({ kind: 'rejected' });
    expect(deletes()).toEqual([]);
  });

  it('reports an engine failure as a calculation error, without writing', async () => {
    state.engine = () => { throw new Error('engine bug'); };
    await expect(recalcRoundLevelResults('r1')).rejects.toBeInstanceOf(ResultsCalculationError);
    expect(writes()).toEqual([]);
  });
});

describe('cross-group matches never delete before the replacement is saved', () => {
  it('overwrites existing rows in place and deletes nothing if the save fails', async () => {
    state.respond = roundData({
      tournament_hole_results: ops => {
        if (ops.includes('upsert')) return refused;
        if (!ops.includes('delete')) return ok([{ id: 'old1', hole_number: 1 }, { id: 'old2', hole_number: 2 }]);
        return undefined;
      },
    });
    await expect(recalcRoundMatchResults('r1')).rejects.toBeInstanceOf(SubmitError);
    expect(deletes()).toEqual([]);
    const save = state.calls.find(c => c.ops.includes('upsert'))!;
    const rows = save.args[save.ops.indexOf('upsert')][0] as { id: string; hole_number: number }[];
    expect(rows.map(r => r.id)).toEqual(['old1', 'old2']); // same rows, updated in place
  });

  it('re-reads and saves again once if another device saved the same match meanwhile', async () => {
    let saves = 0;
    state.respond = roundData({
      tournament_hole_results: ops => {
        if (ops.includes('upsert')) {
          saves++;
          return saves === 1 ? { data: null, error: { message: 'duplicate key', code: '23505' } } : ok([{ id: 'a' }, { id: 'b' }]);
        }
        return undefined;
      },
    });
    await expect(recalcRoundMatchResults('r1')).resolves.toHaveLength(1);
    expect(saves).toBe(2);
  });

  it('treats a failed match-list read as a failure, not as "no matches"', async () => {
    state.respond = roundData({ tournament_round_matches: () => refused });
    await expect(recalcRoundMatchResults('r1')).rejects.toBeInstanceOf(SubmitError);
    expect(writes()).toEqual([]);
  });

  it('saves the matches it could calculate, then reports the engine failure', async () => {
    state.respond = roundData({
      tournament_round_matches: () => ok([
        { id: 'm1', tournament_round_id: 'r1', match_number: 1, side_a: ['p1'], side_b: ['p2'] },
        { id: 'm2', tournament_round_id: 'r1', match_number: 2, side_a: ['p1'], side_b: ['p2'] },
      ]),
    });
    let n = 0;
    state.engine = () => {
      n++;
      if (n === 2) throw new Error('engine bug');
      return { holeResults: [{ holeNumber: 1, teamPoints: {}, playerPoints: {}, pointsValue: 1, resultLabel: 'A' }] };
    };
    state.respond = ((base) => (table: string, ops: string[], args: unknown[][]) =>
      table === 'tournament_hole_results' && ops.includes('upsert') ? ok([{ id: 'a' }]) : base(table, ops, args))(state.respond);
    await expect(recalcRoundMatchResults('r1')).rejects.toThrow('match 2');
    expect(state.calls.filter(c => c.ops.includes('upsert'))).toHaveLength(1);
  });
});

describe('planResultRewrite', () => {
  it('reuses existing ids per hole, adds new holes, and lists stale rows', () => {
    let n = 0;
    const plan = planResultRewrite(
      [{ id: 'h1', hole_number: 1 }, { id: 'h2', hole_number: 2 }, { id: 'dup', hole_number: 1 }],
      [{ hole_number: 1 }, { hole_number: 3 }],
      () => `new${++n}`,
    );
    expect(plan.rows).toEqual([{ hole_number: 1, id: 'h1' }, { hole_number: 3, id: 'new1' }]);
    expect(plan.staleIds.sort()).toEqual(['dup', 'h2']);
  });
});

describe('findHolesMissingResults', () => {
  const score = (player: string, hole: number, group = 'g1') =>
    ({ tournament_group_id: group, tournament_player_id: player, hole_number: hole, gross_score: 4 });

  it('flags match holes that every player scored but that have no result', () => {
    expect(findHolesMissingResults({
      matches: [{ id: 'm1', sideA: ['a'], sideB: ['b'] }],
      isRoundLevel: false,
      groupIds: ['g1'],
      roundPlayerIds: ['a', 'b'],
      scores: [score('a', 1), score('b', 1), score('a', 2), score('b', 2), score('a', 3)],
      results: [{ tournament_match_id: 'm1', hole_number: 1 }],
    })).toEqual([2]); // hole 3 isn't complete yet
  });

  it('flags whole-round holes missing on the anchor group', () => {
    expect(findHolesMissingResults({
      matches: [],
      isRoundLevel: true,
      groupIds: ['anchor', 'g2'],
      roundPlayerIds: ['a', 'b'],
      scores: [score('a', 1, 'anchor'), score('b', 1, 'g2'), score('a', 2, 'anchor'), score('b', 2, 'g2')],
      results: [{ tournament_group_id: 'anchor', hole_number: 2 }, { tournament_group_id: 'g2', hole_number: 1 }],
    })).toEqual([1]);
  });

  it('says nothing for per-foursome rounds', () => {
    expect(findHolesMissingResults({
      matches: [], isRoundLevel: false, groupIds: ['g1'], roundPlayerIds: ['a'], scores: [score('a', 1)], results: [],
    })).toEqual([]);
  });
});
