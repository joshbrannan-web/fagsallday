# Make the Round Points Award visible on the test scorecard

## What I confirmed

- The round is configured exactly as you described: tournament scoring method `custom_pts_per_round`, round mode `Front/Back/Overall` with 2 / 2 / 2 points.
- The award card component exists and is wired into both the Test Console and the Test Scorecard page, and its render conditions are satisfied for this round.
- So the code path is correct; the card just isn't reaching your browser or is rendering below the fold on a stale bundle. The service worker cache key (`golf-app-v4`) hasn't changed since the card was added, which is the most likely reason the old bundle is still being served.

## Plan

1. Bump the service worker cache name so every device drops the stale bundle and picks up the new scorecard build.
2. Move the Round Points Award card to the top of the Test Scorecard page (directly under the test banner) so the awarded points are the first thing seen, above the hole-by-hole 8.5 – 9.5 totals.
3. Add the awarded segment totals inline to the Group section header (e.g. "Round award: Team A 2 — Team B 4") so hole points and awarded points are never confused.
4. Verify in the running preview by loading the test scorecard route and confirming the Front 9 / Back 9 / Overall rows and the 2/2/2 award appear with the correct winners.

## Technical notes

- `public/sw.js`: `CACHE_NAME` → `golf-app-v5`.
- `src/pages/TournamentAdminTestScorecard.tsx`: render `awardCard` above the group/match sections instead of after them; pass the same computed award values down to `TestScorecardSection` for the header line.
- `src/components/tournament-admin/TestScorecardSection.tsx`: optional `awardLine` prop rendered next to the existing hole-point totals.
- No scoring-engine or database changes — hole points and award math stay exactly as they are.
