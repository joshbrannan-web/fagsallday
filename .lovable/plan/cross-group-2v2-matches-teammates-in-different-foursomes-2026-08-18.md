# Cross-group 2v2 matches (teammates in different foursomes)

## Answering the question first

- The round-level change only applies to `match_play_gross_best_ball` and `blind_gross_best_ball` (see `ROUND_LEVEL_GAME_TYPES` in `src/services/roundLevelScoring.ts`). Those are now one 4-v-4 team match for the whole round, pooling every player on a team across all foursomes.
- 2v2 Best Ball (`match_play_best_ball`) is unchanged: it is still scored strictly inside one foursome. `calcMatchPlayBestBall` splits the group's players by team and compares each side's best ball.
- So today, if A1 and B1 are partners but A1 plays in a different foursome, there is nothing in setup that says "these two are partners against those two". The only cross-player structure that exists is `subMatchups` in `tournament_groups.team_matchup`, and that is 1-v-1 pairs **within a single group** (individual match play / twosome formats).
- Blind Gross Best Ball is not the answer here — it pools all four players per team, not a specific 2-man partnership.

To support your case we need a new round-level concept: a **Match** that names Side A players and Side B players, independent of which foursome each player is in.

## What gets built

### 1. Round Matches (setup)

In the round pairings editor, a new **Matches** section (shown for 2-player-per-side formats: best ball, gross best ball, alternate shot, scramble 2, two-man score):

- "Add match" → pick Side A players and Side B players from the round's roster (2 per side for 2v2; 1 per side for singles).
- Each player can appear in at most one match per round; the editor warns about unassigned players.
- Matches are listed with each player's foursome number next to their name, so it is obvious when partners are split across groups.
- Foursomes (groups) stay exactly as they are — they only decide who enters scores together.

### 2. Scoring

- When a round has matches defined, scoring for that round runs match-by-match against the round-wide score pool (all `tournament_hole_scores` for every group in the round), so a partner in another foursome still counts.
- Each hole is decided once the four players in that match have a score, regardless of group.
- Round totals = sum of every match's points, feeding existing team scoreboards unchanged.
- If no matches are defined, behaviour is exactly what it is today (per-foursome), so nothing existing breaks.

### 3. Display

- Round scoreboard lists one row per match ("A1 & B1 vs A2 & B2 — 2 UP thru 14") instead of one row per foursome.
- Player hub / live overlay shows the player their own match status, not their foursome's.
- Group scorecards still show the foursome's raw scores.

## Technical notes

- New table `public.tournament_round_matches`: `id`, `tournament_round_id`, `match_number`, `side_a` (jsonb array of tournament_player_id), `side_b`, `team_a_id`, `team_b_id`, timestamps. Grants for `authenticated` + `service_role`, RLS mirroring `tournament_groups` (tournament members read, admins/creator write).
- `tournament_hole_results` gains a nullable `tournament_match_id` plus a unique index on `(tournament_match_id, hole_number)`; the existing `(tournament_group_id, hole_number)` unique index stays for group-scored formats. Match rows carry a null group id.
- `src/services/roundLevelScoring.ts`: generalise `buildRoundLevelContext` to return the round-wide score/player pool, then add `recalcRoundMatches(roundId)` that builds one `EngineInput` per match (players = the four in the match, teamAssignments from the match sides) and upserts results keyed by match id. Existing 4v4 gross-best-ball path stays as the anchor-group case.
- Read paths updated to prefer match rows when the round has matches: `useTournamentScoreboards.ts` (backfill + aggregation), `useTournamentScorecard.ts` (recalc after score entry), `useTournamentOverlay.ts` (live status).
- `RoundPairingsEditor.tsx` gets the Matches UI; `useTournamentRoundSetup.ts` gets `addMatch` / `deleteMatch` / `fetchMatches`.
- Engine tests: a 2v2 best ball where the two partners sit in different groups produces the same result as when they share a foursome.
