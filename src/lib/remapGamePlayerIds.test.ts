import { describe, it, expect } from 'vitest';
import { remapGamePlayerIds } from './remapGamePlayerIds';

describe('remapGamePlayerIds', () => {
  it('maps tournament player IDs in FBO teams to round player IDs', () => {
    const games: any = [{ id: 'g', type: 'FBO', config: { fboPlayers: ['tpA', 'tpB'], fbo: { teams: { teamA: ['tpA'], teamB: ['tpB'] } } } }];
    const [g] = remapGamePlayerIds(games, { '1': 'tpA', '4': 'tpB' });
    expect(g.config.fboPlayers).toEqual(['1', '4']);
    expect(g.config.fbo.teams).toEqual({ teamA: ['1'], teamB: ['4'] });
  });
});
