# Fix back navigation losing your place

Right now the back arrow on detail pages (Scorecard & Results, Test Scorecard, Group Scorecard, Scoreboards) jumps to a hard-coded landing page, so the tournament admin dashboard reopens on Overview and the viewer scoreboards page resets to its default board.

## What changes

- Back buttons return to the previous page you were actually on, instead of a fixed destination. If there is no in-app history (a link opened directly), they fall back to the current hard-coded destination.
- The tournament admin dashboard remembers which tab you were on (Overview / Rounds / Players / Teams / Results / Side Bets) by putting it in the URL, so returning from a scorecard lands back on the same tab.
- The tournament viewer scoreboards page remembers which scoreboard was selected the same way, so returning from a scorecard shows the same board.

Pages covered: admin Round Scorecard & Results, admin Test Scorecard, Test Console, admin Group Scorecard, admin Scoreboards, viewer Scorecard & Results, viewer Group Scorecard, viewer Scoreboards.

## Technical notes

- Add a small `useSmartBack(fallbackPath)` hook (`src/hooks/useSmartBack.ts`): returns a callback that calls `navigate(-1)` when `window.history.state?.idx > 0`, otherwise `navigate(fallbackPath, { replace: true })`. Note the app uses HashRouter-style URLs; the history idx check works for both.
- Swap each back button's `onClick` in: `TournamentAdminRoundScorecard.tsx`, `TournamentViewRoundScorecard.tsx`, `TournamentAdminTestScorecard.tsx`, `TournamentAdminTestConsole.tsx`, `TournamentAdminScorecard.tsx`, `TournamentGroupScorecard.tsx`, `TournamentAdminScoreboards.tsx`, `TournamentAdminDashboard.tsx`, `TournamentScoreboards.tsx`, `TournamentAdminLiveView.tsx` — keeping the existing route as the fallback.
- `TournamentAdminDashboard.tsx`: replace `useState('overview')` with a `useSearchParams`-backed tab value (`?tab=`), writing with `replace: true` on tab change so the tab switch does not add history entries.
- `TournamentScoreboards.tsx`: mirror that pattern for `selectedId` via `?sb=`, defaulting to the existing group_matches preference when the param is absent.
- Presentation/navigation only — no data, scoring, or backend changes.
