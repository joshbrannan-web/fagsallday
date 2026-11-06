import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  native: true,
  calls: [] as string[],
  files: new Map<string, string>(),
  shareError: null as null | Error,
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native } }));
vi.mock('@capacitor/haptics', () => ({
  ImpactStyle: { Light: 'LIGHT' },
  Haptics: {
    impact: async (o: { style: string }) => { state.calls.push(`impact ${o.style}`); },
    selectionStart: async () => { state.calls.push('selectionStart'); },
    selectionChanged: async () => { state.calls.push('selectionChanged'); },
    selectionEnd: async () => { state.calls.push('selectionEnd'); },
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: async (o: { path: string; data: string; directory: string }) => {
      const key = `${o.directory}/${o.path}`;
      state.files.set(key, o.data);
      return { uri: `file:///cache/${o.path}` };
    },
  },
}));
vi.mock('@capacitor/share', () => ({
  Share: {
    share: async (o: { files?: string[]; text?: string }) => {
      state.calls.push(`share ${o.files ? o.files.join(',') : 'text'}`);
      if (state.shareError) throw state.shareError;
      return {};
    },
  },
}));

import { hapticTap, hapticTick, SHARE_IMAGE_FILE, shareImageNative, shareTextNative } from './native';

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  state.native = true;
  state.calls = [];
  state.files.clear();
  state.shareError = null;
});

describe('haptics', () => {
  it('ticks on a score change and taps on a confirmed hole, in the iPhone app', async () => {
    hapticTick();
    hapticTap();
    await flush();
    expect(state.calls).toEqual(['selectionStart', 'impact LIGHT', 'selectionChanged', 'selectionEnd']);
  });

  it('does nothing on the website', async () => {
    state.native = false;
    hapticTick();
    hapticTap();
    await flush();
    expect(state.calls).toEqual([]);
  });
});

describe('sharing a scorecard image', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';

  it('saves it to the cache folder and opens the share sheet with that file', async () => {
    expect(await shareImageNative(png, 'Pebble Scorecard')).toBe('shared');
    expect(state.files.get(`CACHE/${SHARE_IMAGE_FILE}`)).toBe('iVBORw0KGgo=');
    expect(state.calls).toEqual([`share file:///cache/${SHARE_IMAGE_FILE}`]);
  });

  it('50 shares over a season leave exactly one file behind', async () => {
    for (let i = 0; i < 50; i++) {
      await shareImageNative(`data:image/png;base64,round${i}`, `Course ${i} Scorecard`);
    }
    expect(Array.from(state.files.keys())).toEqual([`CACHE/${SHARE_IMAGE_FILE}`]);
    expect(state.files.get(`CACHE/${SHARE_IMAGE_FILE}`)).toBe('round49'); // the latest
  });

  it('closing the share sheet is not an error', async () => {
    state.shareError = new Error('Share canceled');
    expect(await shareImageNative(png, 'x')).toBe('cancelled');
    expect(await shareTextNative('t', 'x')).toBe('cancelled');
  });

  it('real failures are reported', async () => {
    state.shareError = new Error('Something broke');
    await expect(shareTextNative('t', 'x')).rejects.toThrow('Something broke');
  });
});
