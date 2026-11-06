// Decides when the iPhone app keeps the screen on, and makes sure it always lets go.
//
// The screen is kept on only while ALL of these are true:
//   - the round screen wants it (enabled)
//   - the app is in the foreground (visible)
//   - someone has touched the screen in the last 30 minutes (not idle)
// Every change is applied strictly in order, so a late "keep awake" can never land after
// a "release", and a failed call can't leave the screen stuck on.

export const IDLE_RELEASE_MS = 30 * 60 * 1000;

export interface KeepAwakeApi {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

export interface KeepAwakeController {
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  /** Call on any touch or key press. */
  activity(): void;
  /** Release and stop listening. Safe to call more than once. */
  dispose(): void;
  /** Resolves when all queued changes have been applied (for tests). */
  settled(): Promise<void>;
}

export function createKeepAwakeController(
  api: KeepAwakeApi,
  onChange: (active: boolean) => void = () => {},
  idleMs: number = IDLE_RELEASE_MS,
): KeepAwakeController {
  let enabled = false;
  let visible = true;
  let idle = false;
  let disposed = false;
  let applied: boolean | null = null; // what the device was last told
  let chain: Promise<void> = Promise.resolve();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const wanted = () => !disposed && enabled && visible && !idle;

  const sync = () => {
    chain = chain.then(async () => {
      const want = wanted(); // decided when this step runs, so the latest state always wins
      if (want === applied) return;
      try {
        if (want) await api.keepAwake();
        else await api.allowSleep();
        applied = want;
        onChange(want);
      } catch (error) {
        // Couldn't change it. If we were trying to release, try once more; never leave it on.
        if (!want) {
          try { await api.allowSleep(); applied = false; onChange(false); } catch { /* nothing more */ }
        }
        console.warn('Keep-awake change failed', error);
      }
    });
  };

  const restartIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    if (disposed || !enabled) return;
    idleTimer = setTimeout(() => {
      idle = true;
      sync();
    }, idleMs);
  };

  return {
    setEnabled(next) {
      enabled = next;
      idle = false;
      restartIdleTimer();
      sync();
    },
    setVisible(next) {
      visible = next;
      if (next) {
        idle = false; // coming back counts as activity
        restartIdleTimer();
      }
      sync();
    },
    activity() {
      if (disposed || !enabled) return;
      const wasIdle = idle;
      idle = false;
      restartIdleTimer();
      if (wasIdle) sync();
    },
    dispose() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      disposed = true;
      sync();
    },
    settled: () => chain,
  };
}
