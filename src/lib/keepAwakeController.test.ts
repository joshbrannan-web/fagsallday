import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeepAwakeController, IDLE_RELEASE_MS } from './keepAwakeController';

function fakeApi() {
  const calls: string[] = [];
  let screenOn = false;
  let failNext = false;
  let delayMs = 0;
  const step = async (name: string, on: boolean) => {
    calls.push(name);
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (failNext) { failNext = false; throw new Error('plugin failed'); }
    screenOn = on;
  };
  return {
    calls,
    get screenOn() { return screenOn; },
    failNext() { failNext = true; },
    slow(ms: number) { delayMs = ms; },
    keepAwake: () => step('keepAwake', true),
    allowSleep: () => step('allowSleep', false),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('keep-awake in the iPhone app', () => {
  it('keeps the screen on during an active round', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    await c.settled();
    expect(api.screenOn).toBe(true);
  });

  it('releases when the round screen closes', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    c.dispose();
    await c.settled();
    expect(api.screenOn).toBe(false);
  });

  it('releases when the round ends (disabled) and when the app goes to the background', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    await c.settled();
    c.setVisible(false);
    await c.settled();
    expect(api.screenOn).toBe(false);
    c.setVisible(true);
    await c.settled();
    expect(api.screenOn).toBe(true); // back on when they return to the round
    c.setEnabled(false);
    await c.settled();
    expect(api.screenOn).toBe(false);
  });

  it('releases after 30 minutes without a touch, and the next touch turns it back on', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    await c.settled();
    await vi.advanceTimersByTimeAsync(IDLE_RELEASE_MS - 1000);
    expect(api.screenOn).toBe(true);
    c.activity(); // a tap 29m59s in resets the clock
    await vi.advanceTimersByTimeAsync(IDLE_RELEASE_MS - 1000);
    expect(api.screenOn).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await c.settled();
    expect(api.screenOn).toBe(false);
    c.activity();
    await c.settled();
    expect(api.screenOn).toBe(true);
    c.dispose();
  });

  it('a slow "keep awake" can never land after a release', async () => {
    const api = fakeApi();
    api.slow(500);
    const c = createKeepAwakeController(api);
    c.setEnabled(true);  // starts a slow keepAwake
    await vi.advanceTimersByTimeAsync(100); // keepAwake is now in progress
    expect(api.calls).toEqual(['keepAwake']);
    c.dispose();         // released before it finishes
    await vi.advanceTimersByTimeAsync(2000);
    await c.settled();
    expect(api.calls).toEqual(['keepAwake', 'allowSleep']);
    expect(api.screenOn).toBe(false);
  });

  it('released before the keep-awake even started: it is never sent', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    c.dispose();
    await c.settled();
    expect(api.calls).not.toContain('keepAwake');
    expect(api.screenOn).toBe(false);
  });

  it('rapid on/off ends in the last requested state', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    for (let i = 0; i < 10; i++) { c.setVisible(i % 2 === 0); c.setEnabled(true); }
    c.setVisible(false);
    await c.settled();
    expect(api.screenOn).toBe(false);
  });

  it('if releasing fails, it tries again rather than leaving the screen on', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    await c.settled();
    api.failNext();
    c.dispose();
    await c.settled();
    expect(api.calls.filter(x => x === 'allowSleep')).toHaveLength(2);
    expect(api.screenOn).toBe(false);
  });

  it('stops its timer once the round screen closes', async () => {
    const api = fakeApi();
    const c = createKeepAwakeController(api);
    c.setEnabled(true);
    c.dispose();
    await c.settled();
    const before = api.calls.length;
    await vi.advanceTimersByTimeAsync(IDLE_RELEASE_MS * 3);
    c.activity();
    await c.settled();
    expect(api.calls.length).toBe(before);
    expect(api.screenOn).toBe(false);
  });
});
