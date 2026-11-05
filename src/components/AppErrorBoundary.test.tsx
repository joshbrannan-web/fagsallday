import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CrashScreen, type Step } from './AppErrorBoundary';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function setStorage(value: unknown | (() => never)) {
  Object.defineProperty(globalThis, 'localStorage', typeof value === 'function'
    ? { get: value as () => never, configurable: true }
    : { value, configurable: true });
}

function mapStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); }, key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

const render = (step: Step = 'main', error: unknown = new Error('boom')) =>
  renderToStaticMarkup(<CrashScreen error={error} initialStep={step} />);

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as Record<string, unknown>).localStorage;
});

describe('CrashScreen never crashes itself', () => {
  it('renders when storage throws on access', () => {
    setStorage(() => { throw new Error('storage blocked'); });
    expect(render()).toContain('Something went wrong');
  });

  it('renders when the error itself cannot be turned into text', () => {
    setStorage(mapStorage({}));
    const nasty = { toString() { throw new Error('no'); } };
    expect(render('main', nasty)).toContain('Something went wrong');
  });

  it('shows the strongest warning when storage cannot be read', () => {
    setStorage(() => { throw new Error('storage blocked'); });
    expect(render('confirm-reset')).toContain('permanently deletes rounds and courses');
  });
});

describe('reset confirmation wording', () => {
  it('signed out with saved rounds: unmistakable permanent-loss warning with counts', () => {
    setStorage(mapStorage({ fg_history: '[{},{},{}]', fg_saved_courses: '[{}]' }));
    const html = render('confirm-reset');
    expect(html).toContain('permanently deletes rounds and courses that exist only on this phone');
    expect(html).toContain('without an account');
    expect(html).toContain('3 rounds and 1 saved course');
    expect(html).toContain('disabled'); // delete button locked until the box is ticked
  });

  it('signed in with nothing phone-only: says it reloads from the account', () => {
    setStorage(mapStorage({ 'sb-x-auth-token': JSON.stringify({ refresh_token: 'r' }) }));
    const html = render('confirm-reset');
    expect(html).toContain('will load again from the server');
    expect(html).not.toContain('permanently');
  });

  it('signed in but with rounds saved before signing in: still the permanent-loss warning', () => {
    setStorage(mapStorage({ 'sb-x-auth-token': JSON.stringify({ refresh_token: 'r' }), fg_history: '[{}]' }));
    const html = render('confirm-reset');
    expect(html).toContain('before you signed in');
    expect(html).toContain('permanently deleted');
  });
});

describe('unsent scores', () => {
  it('tells the player how many scores are still waiting', () => {
    setStorage(mapStorage({ fg_sync_queue: '[{},{}]' }));
    expect(render()).toContain('2 scores haven&#x27;t been sent yet');
  });

  it('does not offer deleting unsent scores until a reset has been tried', () => {
    setStorage(mapStorage({ fg_sync_queue: '[{}]' }));
    expect(render()).not.toContain('Delete unsent scores');
  });
});
