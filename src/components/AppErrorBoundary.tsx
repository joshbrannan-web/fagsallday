import React from 'react';
import {
  deleteUnsentScores,
  inspectSavedData,
  removeDamagedData,
  resetSavedData,
  type SavedDataSnapshot,
} from '@/lib/recoveryStorage';

// The crash screen shown instead of a blank page when something fails while drawing
// the app. It deliberately uses nothing from the rest of the app (no sign-in, router,
// toasts or shared components), and is itself wrapped in a last-resort boundary, so
// a problem in the app (or in this screen) still leaves the player a way out.

const SAFE_SNAPSHOT: SavedDataSnapshot = {
  unsentCount: null,
  hasUnsent: false,
  // When we can't look, assume there is phone-only data so the stronger warning shows.
  phoneOnly: { hasData: true, rounds: null, courses: null },
  signedIn: false,
  damagedKeys: [],
  resetRecentlyTried: false,
};

function describeError(error: unknown): string {
  try {
    if (error instanceof Error) return `${error.name}: ${error.message}\n\n${error.stack ?? ''}`.trim();
    return String(error);
  } catch {
    return 'No details available.';
  }
}

function reloadApp(goHome: boolean) {
  try {
    if (goHome) window.location.hash = '#/';
  } catch {
    /* fall through to reload */
  }
  window.location.reload();
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const DAMAGED_LABELS: Record<string, string> = {
  fg_current_round: 'the current round',
  fg_history: 'round history',
  fg_saved_courses: 'saved courses',
  fg_offline_round: 'the saved copy of the active round',
  fg_offline_round_meta: 'the saved copy of the active round',
};

export type Step = 'main' | 'confirm-reset' | 'confirm-delete-unsent';

const buttonBase = 'w-full rounded-md px-4 py-3 text-sm font-medium border transition-colors disabled:opacity-50';
const primaryButton = `${buttonBase} bg-primary text-primary-foreground border-primary`;
const secondaryButton = `${buttonBase} bg-background text-foreground border-border`;
const dangerButton = `${buttonBase} bg-destructive text-destructive-foreground border-destructive`;

export function CrashScreen({ error, initialStep = 'main' }: { error: unknown; initialStep?: Step }) {
  const [step, setStep] = React.useState<Step>(initialStep);
  const [understood, setUnderstood] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [data] = React.useState<SavedDataSnapshot>(() => {
    try {
      return inspectSavedData();
    } catch {
      return SAFE_SNAPSHOT;
    }
  });

  const details = React.useMemo(() => describeError(error), [error]);

  const unsentLine = (() => {
    if (!data.hasUnsent) return null;
    if (data.unsentCount === null) return "Some scores haven't been sent yet. They're still saved on this phone.";
    const one = data.unsentCount === 1;
    return `${plural(data.unsentCount, 'score', 'scores')} ${one ? "hasn't" : "haven't"} been sent yet. ${one ? "It's" : "They're"} still saved on this phone and will send once the app is working.`;
  })();

  const damagedLabels = Array.from(new Set(data.damagedKeys.map(k => DAMAGED_LABELS[k] ?? 'cached leaderboards')));

  const goTo = (next: Step) => {
    setUnderstood(false);
    setStep(next);
  };

  if (step === 'confirm-reset') {
    const { phoneOnly, signedIn } = data;
    const counts = [
      phoneOnly.rounds ? plural(phoneOnly.rounds, 'round', 'rounds') : null,
      phoneOnly.courses ? plural(phoneOnly.courses, 'saved course', 'saved courses') : null,
    ].filter(Boolean).join(' and ');

    if (phoneOnly.hasData) {
      // The case that permanently loses data: make it unmistakable.
      return (
        <Shell>
          <div className="rounded-md border-2 border-destructive bg-destructive/10 p-4 space-y-3">
            <p className="text-base font-bold text-destructive">
              This permanently deletes rounds and courses that exist only on this phone
            </p>
            <p className="text-sm">
              {signedIn
                ? 'Some of your rounds and courses were saved on this phone before you signed in. They were never uploaded to your account.'
                : "You're using the app without an account, so your round history and saved courses are stored only on this phone."}
              {counts ? ` That's ${counts}.` : ''}
            </p>
            <p className="text-sm font-semibold">
              Resetting deletes them for good. They can't be recovered, by you or by anyone else.
            </p>
            {unsentLine && <p className="text-sm">Unsent scores are kept.</p>}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={understood}
                onChange={e => setUnderstood(e.target.checked)}
              />
              <span>I understand my rounds and courses on this phone will be permanently deleted.</span>
            </label>
          </div>
          <button
            type="button"
            className={dangerButton}
            disabled={!understood}
            onClick={() => { resetSavedData(); reloadApp(true); }}
          >
            Permanently delete and reset
          </button>
          <button type="button" className={secondaryButton} onClick={() => goTo('main')}>Cancel</button>
        </Shell>
      );
    }

    return (
      <Shell>
        <p className="text-base font-semibold">Reset saved data on this phone?</p>
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? "This clears the app's saved copies on this phone. Your rounds and courses are saved to your account and will load again from the server. You'll stay signed in."
            : "There are no saved rounds or courses on this phone to lose. This clears the app's temporary data and reloads."}
          {unsentLine ? ' Unsent scores are kept.' : ''}
        </p>
        <button type="button" className={primaryButton} onClick={() => { resetSavedData(); reloadApp(true); }}>
          Reset and reload
        </button>
        <button type="button" className={secondaryButton} onClick={() => goTo('main')}>Cancel</button>
      </Shell>
    );
  }

  if (step === 'confirm-delete-unsent') {
    const what = data.unsentCount ? plural(data.unsentCount, 'unsent score', 'unsent scores') : 'all unsent scores';
    return (
      <Shell>
        <div className="rounded-md border-2 border-destructive bg-destructive/10 p-4 space-y-3">
          <p className="text-base font-bold text-destructive">Delete {what}?</p>
          <p className="text-sm">
            These scores haven't reached the server. Deleting them means they're lost unless they're
            entered again. Only do this if resetting saved data didn't fix the problem.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={understood} onChange={e => setUnderstood(e.target.checked)} />
            <span>I understand these scores will be lost.</span>
          </label>
        </div>
        <button
          type="button"
          className={dangerButton}
          disabled={!understood}
          onClick={() => { deleteUnsentScores(); reloadApp(true); }}
        >
          Delete unsent scores and reload
        </button>
        <button type="button" className={secondaryButton} onClick={() => goTo('main')}>Cancel</button>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xl font-bold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">The app hit a problem and couldn't show this screen.</p>
      {unsentLine && <p className="text-sm">{unsentLine}</p>}

      <button type="button" className={primaryButton} onClick={() => reloadApp(false)}>Reload</button>
      <button type="button" className={secondaryButton} onClick={() => reloadApp(true)}>Go to home screen</button>

      {damagedLabels.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm">
            Some saved data on this phone can no longer be read ({damagedLabels.join(', ')}). Removing just
            that is the safest fix: it's unreadable, so nothing the app could still show you is lost.
          </p>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => { removeDamagedData(data.damagedKeys); reloadApp(true); }}
          >
            Remove damaged data and reload
          </button>
        </div>
      )}

      <div className="space-y-2 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">If the problem keeps happening:</p>
        <button type="button" className={secondaryButton} onClick={() => goTo('confirm-reset')}>
          Reset saved data on this phone…
        </button>
        {data.resetRecentlyTried && data.hasUnsent && (
          <button type="button" className={secondaryButton} onClick={() => goTo('confirm-delete-unsent')}>
            Still not working? Delete unsent scores…
          </button>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="text-xs underline text-muted-foreground"
          onClick={() => setShowDetails(v => !v)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
        {showDetails && (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
            {details}
          </pre>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-3">{children}</div>
    </div>
  );
}

/** If the crash screen itself fails, show the most basic way out. No logic, nothing to break. */
function MinimalFallback() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '40px auto' }}>
      <p style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</p>
      <p>The app hit a problem. Nothing on this phone has been deleted.</p>
      <p>
        <a href="/" style={{ textDecoration: 'underline' }}>Reload the app</a>
      </p>
    </div>
  );
}

class LastResortBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    try { console.error('Crash screen failed to render', error); } catch { /* ignore */ }
  }
  render() {
    return this.state.failed ? <MinimalFallback /> : this.props.children;
  }
}

interface State {
  error: unknown;
  hasError: boolean;
}

/** Wraps the whole app: any error while drawing the screen shows the crash screen. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    try { console.error('App crashed while rendering', error, info?.componentStack); } catch { /* ignore */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <LastResortBoundary>
        <CrashScreen error={this.state.error} />
      </LastResortBoundary>
    );
  }
}
