// Silent retries for the tournament round submission.
//
// Every submit step is safe to repeat (reads, or writes that land on a fixed
// player/hole or group slot), so a request that timed out on the phone but was
// actually applied on the server is harmless to send again.

export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAYS_MS = [1_000, 3_000]; // up to 3 tries per step
export const SUBMIT_DEADLINE_MS = 30_000;
/** Don't start a new try with less than this left before the deadline. */
const MIN_ATTEMPT_MS = 1_000;

export type SubmitFailureKind = 'connection' | 'rejected';

export class SubmitError extends Error {
  constructor(public kind: SubmitFailureKind, message: string, public cause?: unknown) {
    super(message);
    this.name = 'SubmitError';
  }

  /** The database error code behind a refusal, e.g. '23505' for a unique-key clash. */
  get code(): string | undefined {
    const c = (this.cause as { code?: unknown } | undefined)?.code;
    return c === undefined || c === null ? undefined : String(c);
  }
}

/**
 * True when an error means the request never got a usable answer (dropped connection,
 * timeout, gateway error) rather than the server refusing it. Only these are retried.
 */
export function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string; code?: string | number; status?: number };
  const text = `${e.name ?? ''} ${e.message ?? ''}`;
  if (/AbortError|TimeoutError|Failed to fetch|NetworkError|Load failed|network|timed out/i.test(text)) return true;
  if (typeof e.status === 'number' && (e.status === 0 || e.status >= 500)) return true;
  // Server refusals from the database carry an error code; transport failures don't.
  return e.code === undefined || e.code === null || e.code === '';
}

interface RetryOptions {
  /** Absolute time (ms) after which no new try is started. */
  deadline: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Run one submit step, retrying connection failures with short waits.
 * Each try is cut off after REQUEST_TIMEOUT_MS, or sooner if the overall deadline is
 * closer. Throws SubmitError('rejected') at once if the server refuses, and
 * SubmitError('connection') when the tries or the time run out.
 */
export async function runWithRetry<T>(
  step: (signal: AbortSignal) => PromiseLike<{ data: T; error: unknown }>,
  { deadline, now = Date.now, sleep = defaultSleep }: RetryOptions,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const wait = RETRY_DELAYS_MS[attempt - 1];
      if (deadline - now() - wait < MIN_ATTEMPT_MS) break;
      await sleep(wait);
    }
    const remaining = deadline - now();
    if (remaining < MIN_ATTEMPT_MS) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
    try {
      const { data, error } = await step(controller.signal);
      if (!error) return data;
      lastError = error;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }

    if (!isConnectionError(lastError)) {
      throw new SubmitError('rejected', `Server refused the request: ${describe(lastError)}`, lastError);
    }
  }

  throw new SubmitError('connection', `Could not reach the server: ${describe(lastError ?? 'out of time')}`, lastError);
}

function describe(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}
