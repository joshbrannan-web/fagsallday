import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/haptics', () => ({ Haptics: {}, ImpactStyle: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));

import { applyNativeViewport } from './native';

function fakeDoc(viewport: string | null) {
  let content = viewport;
  const classes = new Set<string>();
  const meta = viewport === null ? null : {
    getAttribute: () => content,
    setAttribute: (_: string, v: string) => { content = v; },
  };
  return {
    doc: {
      querySelector: () => meta,
      documentElement: { classList: { add: (c: string) => classes.add(c) } },
    } as never,
    get content() { return content; },
    classes,
  };
}

describe('applyNativeViewport', () => {
  it('in the iOS app: asks for the full screen and switches on the safe-area rules', () => {
    const f = fakeDoc('width=device-width, initial-scale=1.0');
    applyNativeViewport(f.doc, true);
    expect(f.content).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover');
    expect(f.classes.has('native-app')).toBe(true);
  });

  it('on the website: changes nothing', () => {
    const f = fakeDoc('width=device-width, initial-scale=1.0');
    applyNativeViewport(f.doc, false);
    expect(f.content).toBe('width=device-width, initial-scale=1.0');
    expect(f.classes.size).toBe(0);
  });

  it('by default it checks whether it is in the app (here: the website)', () => {
    const f = fakeDoc('width=device-width');
    applyNativeViewport(f.doc);
    expect(f.content).toBe('width=device-width');
  });

  it('running twice does not add the setting twice', () => {
    const f = fakeDoc('width=device-width');
    applyNativeViewport(f.doc, true);
    applyNativeViewport(f.doc, true);
    expect(f.content).toBe('width=device-width, viewport-fit=cover');
  });
});
