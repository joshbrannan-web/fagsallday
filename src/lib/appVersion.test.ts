import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: '9.9', build: '99' }) } }));
vi.mock('@capacitor/haptics', () => ({ Haptics: {}, ImpactStyle: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));

import { getAppVersionLabel } from './appVersion';

describe('getAppVersionLabel', () => {
  it('in the iOS app: shows the real Version and Build from Xcode', async () => {
    expect(await getAppVersionLabel(true, async () => ({ version: '1.0', build: '1' }))).toBe('v1.0 (1)');
    expect(await getAppVersionLabel(true, async () => ({ version: '1.2.0', build: '14' }))).toBe('v1.2.0 (14)');
  });

  it('does not repeat the build when it equals the version', async () => {
    expect(await getAppVersionLabel(true, async () => ({ version: '1.0', build: '1.0' }))).toBe('v1.0');
  });

  it('on the website: says "Web"', async () => {
    expect(await getAppVersionLabel(false)).toBe('Web');
    expect(await getAppVersionLabel()).toBe('Web'); // default check: not the app
  });

  it('if the version cannot be read: shows nothing rather than a wrong number', async () => {
    expect(await getAppVersionLabel(true, async () => { throw new Error('no'); })).toBe('');
  });
});
