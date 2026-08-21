# Fix empty Live Group Matches and Team Round Result for CGC 2026

## What's happening

CGC 2026 Round 1 is scored as a single cross-group team match (one match record spanning both foursomes, Team A vs Team B). Confirmed in the data: all 18 hole results for Round 1 are stored against that match, and zero hole results are stored against Group 1 or Group 2.

Both scoreboards only look for results attached to a group:

- `GroupMatchesScoreboard` builds each row from `holeResults.filter(r => r.tournament_group_id === group.id)`.
- `TeamRoundResultScoreboard` filters the same way, per round and per group.

The scoreboard data hook already fetches the match results and tags them with `tournament_round_id`, but neither component reads them. So both boards render rounds with blank/zero scores even though the round is complete and correct.

## The fix

1. **Live Group Matches** — when a round has cross-group matches, render one row per match instead of one row per group:
   - Row header: `Match 1` with each side's player names, team colors, and the running/final team points.
   - Expanded view: hole-by-hole rows using the match's results, same layout and score chips as today, driven by the pooled scores of the players on each side.
   - Rounds without matches keep the current per-group rendering unchanged.

2. **Team Round Result** — include match results for the round, not just group results. The per-round totals become the sum of group results plus match results for that round, so the Round 1 team totals and round award populate. The per-group breakdown rows in the expanded view fall back to the round's match results when the round is match-scored.

3. Round-level pooled formats (results stored on the anchor group) already resolve via the group path and stay as-is.

## Technical notes

- `src/hooks/useTournamentScoreboards.ts` already returns match results with `tournament_round_id` attached — no data-layer change needed; pass `roundMatches` through `ScoreboardRenderer` to the two scoreboards.
- `src/components/scoreboards/GroupMatchesScoreboard.tsx`: add a match branch before the group loop, keyed on `roundMatches` for the round; reuse the existing `ScoreChip`, status-text, and expand/collapse logic.
- `src/components/scoreboards/TeamRoundResultScoreboard.tsx`: widen the round filter to `roundGroupIds.has(hr.tournament_group_id) || hr.tournament_round_id === round.id`.
- Display-only change: no schema, engine, or recalculation changes. Round 1's stored results are already correct.
