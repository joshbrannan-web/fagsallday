# Round 2 (CGC 2026): real 2v2 matches

Round 2 is configured as `match_play_best_ball` (2v2, second-ball tiebreaker, handicaps 100%, F/B/O 2 pts each), but no cross-group matches are defined. The engine therefore scores each foursome as team-vs-team, and today's pairings put 3 players against 1:

```text
Group 1: Kurt, Paul, Erik (SulRakVanJen)  vs  Josh (WilDonBraSah)
Group 2: Steve (SulRakVanJen)             vs  Scott, Grant, Jeff (WilDonBraSah)
```

## What you get

1. **Two proper 2v2 matches for Round 2**, defined at the round level so partners can sit in different foursomes:

```text
Match 1  Kurt Saulnier (3.3) + Erik Jensen (22.0)   vs  Scott Willett (4.8) + Jeff Sahid (22.0)
Match 2  Paul Rakovich (8.1) + Steve Vanzetti (9.1) vs  Grant Donaldson (6.2) + Josh Brannan (10.5)
```
   These are balanced by combined handicap (25.3 v 26.8 and 17.2 v 16.7). Tee-time foursomes stay exactly as they are — only who-plays-who changes. You can edit or replace either match in Set Pairings afterwards.

2. **Uneven-sides warning** in Set Pairings and on the Test Console: when a round's game is a 2v2 format and a group/match has sides that aren't 2 vs 2, an amber notice appears explaining that scoring will not reflect the format, with a pointer to add cross-group matches.

3. **Test round refreshed**: reset and re-run Test Start for Round 2 so the test sandbox mirrors the new matches, then Fill All Scores + View Scorecard & Results shows two real 2v2 match cards with per-hole winners and the F/B/O award (2/2/2).

## Technical notes

- Insert two rows into `tournament_round_matches` for round `6586d8a7…` with `is_test = false`, `match_number` 1 and 2, `side_a` / `side_b` as the tournament player id arrays above, and `team_a_id` / `team_b_id` set to the two team ids so the engine keys team points correctly.
- No schema changes. `recalcRoundMatchResults` already pools scores round-wide per match and clears group-level result rows, so existing scoreboards (`GroupMatchesScoreboard`, `TeamRoundResultScoreboard`, `TeamPointsBreakdownTable`) pick the matches up.
- Warning UI: a small derived check in `RoundPairingsEditor.tsx` (and the group list on `TournamentAdminTestConsole.tsx`) comparing per-team player counts against the expected side size for the round's `game_type` — presentation only, no scoring changes.
- Test mirroring in `src/services/testRounds.ts` already clones `tournament_round_matches`, so a reset + Test Start is all that's needed to see the new matches in test.
