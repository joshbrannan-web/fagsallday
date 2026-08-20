# Front / Back / Overall points (2-2-2) for round scoring

## Why the test round shows 9.5 – 8.5

Round 1's game is **Gross Best Ball (6/6/6)** with **1 point per hole**. The engine awards a point on every hole (half each when tied), so all 18 holes hand out points: 9.5 vs 8.5.

The `2/2/2` idea exists nowhere in this round's config. The only segment-points feature in the app today applies to the separate "Tournament Sixes – sum of strokes" game and splits the round into three 6-hole blocks. Gross Best Ball has no segment/aggregate points path at all, so nothing you set could have produced 2-2-2.

## What to build

A per-round **Points model** setting with two options:

- **Per hole** (current behavior, stays the default).
- **Front / Back / Overall** — three separate match-play matches decided by holes won:
  - Front: holes 1–9, default 2 pts
  - Back: holes 10–18, default 2 pts
  - Overall: all 18 holes, default 2 pts
  - Each value is editable; a tie splits the points (1–1 by default), honoring the round's existing halved-hole rule.

Hole winners are still determined exactly as they are now (Gross Best Ball 6/6/6 net best-ball, or whichever game the round uses) — the change is only how those hole wins convert into points.

### Behavior details

- Front/Back/Overall points are awarded when the segment is complete; partial segments show a live "leads 2 up" style status instead of points.
- Overall is its own match over 18 holes, not the sum of Front and Back, so a team can lose Front and Back yet still win Overall only if it wins more total holes (ties split).
- Max total for the round becomes 6 points instead of 18.

### Where it shows up

- Round setup (Rounds tab / round config card): new "Points model" selector plus three point inputs, shown for any team-vs-team game type.
- Test Console and Test Scorecard: totals reflect the new model, plus a small Front / Back / Overall breakdown line (e.g. `Front: Sul 2 · Back: Wil 2 · Overall: halved 1–1`).
- Live scoreboards, round summary, and Ryder-cup graphic use the same totals automatically since they read the same engine output.

## Technical notes

- Migration on `tournament_games`: add `points_model text not null default 'per_hole'` and `segment_points jsonb default '{"front":2,"back":2,"overall":2}'`. Existing rows keep per-hole behavior, so no other round changes.
- `src/services/tournamentEngine.ts`: after the existing per-hole calculation, when `pointsModel = 'fbo'`, zero out per-hole point values and award segment points on the closing hole of each segment (9, 18, and 18 for Overall), with result labels like `Team X wins Front 9 (5-3)`. Applies to whichever calc function the game type resolves to.
- `src/services/roundLevelScoring.ts`, `useTournamentScoreboards.ts`, `useTournamentScorecard.ts`, `useTournamentOverlay.ts`: pass the two new fields through to the engine config (they already thread `sixesSegmentPoints` the same way).
- `RoundConfigCard.tsx`, `CreateTournamentWizard.tsx`, `WizardStepReview.tsx`, `useTournaments.ts`, `TournamentAdminDashboard.tsx`: read/write the new fields.
- Test scorecard section gains a segment summary row.
- Unit tests in `tournamentEngine.test.ts` for: front win, back win, overall halved, and partial-round (no points yet).

## After the change

Switch Round 1 to Front/Back/Overall with 2/2/2, re-run Fill All Scores, and the test round should total 6 points across the two teams.
