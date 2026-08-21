# Per-Match Points: Status Check and Hardening

## What already works (verified)

- **Database**: `tournament_rounds.team_scoring_mode` already accepts `per_match` (constraint confirmed), and points live in the existing `team_scoring_points` JSON (`front`, `back`, `overall`, `match`). No migration needed.
- **Test rounds**: the test scorecard and Test Console both load group results *and* cross-group match results (`tournament_match_id`), and pass them to the award card, which now renders the match-by-match breakdown. Test awards are computed as if the round were complete, so points show as soon as scores are filled.
- **Live tournament scoreboards**: the scoreboard hook merges match-linked results with group results and tags them with the round, so Team Round Result, Team Points Breakdown, and the Ryder Cup grand total all route `per_match` rounds through the same award function and sum them into standings.
- **Admin round results**: the Rounds results dashboard shows the per-match breakdown (holes won per segment and points awarded per match).

## Gaps worth fixing

1. **Double-counting risk when both result types exist.** `calcRoundMatchAward` builds one scoring unit per match id *and* one per group id. If a round has cross-group matches but stale per-foursome result rows are still present (which happened on CGC 2026 Round 2 before the repair), both sets are scored and the team award is inflated. Fix: when any match-linked rows exist for the round, ignore group-only rows.

2. **Match labels on the public round board.** The Team Round Result scoreboard labels per-match segments as "Match 1, Match 2" by position rather than the real match number. Thread the match numbers already fetched by the scoreboard hook into the labels so they match what admins configured.

3. **Active rounds show raw hole points, not match points.** Like the Front/Back/Overall mode, `per_match` awards only count once the round is marked completed; before that, standings fall back to cumulative hole points. Add an "in progress" projected line on the round board so users can see what each match is currently worth without changing how standings are counted.

4. **Stale-results guard for live rounds.** Reuse the Test Console's existing warning pattern: if a round is set to `per_match`, has matches configured, but no match-linked result rows, show a prompt to recalculate instead of silently awarding 0.

## Technical notes

- `src/services/scoreboardCalculations.ts` — add the match-precedence filter inside `calcRoundMatchAward`; no signature change, so all callers benefit at once.
- `src/components/scoreboards/TeamRoundResultScoreboard.tsx` — accept match-number labels and add the in-progress projection.
- `src/components/tournament-admin/RoundResultsDashboard.tsx` — add the recalculate prompt when match results are missing for a `per_match` round.
- No backend/migration work required; scoring stays a pure client-side derivation from `tournament_hole_results`.
