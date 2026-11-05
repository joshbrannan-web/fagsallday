import { describe, expect, it, vi } from 'vitest';
import { isConnectionError, runWithRetry, SubmitError } from './retry';

/** Fake clock: sleeping advances time instantly so tests don't wait. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    advance: (ms: number) => { t += ms; },
  };
}

const networkError = { message: 'TypeError: Failed to fetch', code: '' };
const refusal = { message: 'permission denied for table', code: '42501' };

describe('isConnectionError', () => {
  it('treats dropped connections and timeouts as retryable', () => {
    expect(isConnectionError(networkError)).toBe(true);
    expect(isConnectionError({ message: 'AbortError: signal is aborted without reason', code: 20 })).toBe(true);
    expect(isConnectionError({ message: 'Bad gateway', status: 502, code: 'PGRST000' })).toBe(true);
  });

  it('treats server refusals as final', () => {
    expect(isConnectionError(refusal)).toBe(false);
    expect(isConnectionError({ message: 'JWT expired', code: 'PGRST301' })).toBe(false);
  });
});

describe('runWithRetry', () => {
  it('returns as soon as a try succeeds', async () => {
    const clock = fakeClock();
    let calls = 0;
    const data = await runWithRetry(async () => {
      calls++;
      return calls < 3 ? { data: null, error: networkError } : { data: 'ok', error: null };
    }, { deadline: 30_000, ...clock });
    expect(data).toBe('ok');
    expect(calls).toBe(3);
    expect(clock.now()).toBe(4_000); // waited 1s, then 3s
  });

  it('gives up after 3 tries with a connection failure', async () => {
    const clock = fakeClock();
    let calls = 0;
    const result = runWithRetry(async () => { calls++; return { data: null, error: networkError }; }, { deadline: 30_000, ...clock });
    await expect(result).rejects.toMatchObject({ kind: 'connection' });
    expect(calls).toBe(3);
  });

  it('does not retry a server refusal', async () => {
    const clock = fakeClock();
    let calls = 0;
    const result = runWithRetry(async () => { calls++; return { data: null, error: refusal }; }, { deadline: 30_000, ...clock });
    await expect(result).rejects.toBeInstanceOf(SubmitError);
    await expect(result).rejects.toMatchObject({ kind: 'rejected' });
    expect(calls).toBe(1);
  });

  it('starts no new try once the overall deadline is too close', async () => {
    const clock = fakeClock();
    let calls = 0;
    const result = runWithRetry(async () => {
      calls++;
      clock.advance(9_500); // each try is slow
      return { data: null, error: networkError };
    }, { deadline: 11_000, ...clock });
    await expect(result).rejects.toMatchObject({ kind: 'connection' });
    // 1st try ends at 9.5s; waiting 1s would leave 0.5s (< 1s), so no 2nd try
    expect(calls).toBe(1);
  });

  it('does not start at all when the deadline has passed', async () => {
    const clock = fakeClock(31_000);
    let calls = 0;
    await expect(runWithRetry(async () => { calls++; return { data: 1, error: null }; }, { deadline: 30_000, ...clock }))
      .rejects.toMatchObject({ kind: 'connection' });
    expect(calls).toBe(0);
  });

  it('cuts off a hung request after 10 seconds and retries', async () => {
    vi.useFakeTimers();
    try {
      const clock = fakeClock();
      let calls = 0;
      const pending = runWithRetry((signal) => {
        calls++;
        if (calls === 1) {
          // Never answers on its own; only the 10-second cut-off ends it
          return new Promise<{ data: string | null; error: unknown }>(resolve => signal.addEventListener('abort', () =>
            resolve({ data: null, error: { message: 'AbortError: aborted', code: 20 } })));
        }
        return Promise.resolve({ data: 'second try' as string | null, error: null as unknown });
      }, { deadline: 30_000, ...clock });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toBe('second try');
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
