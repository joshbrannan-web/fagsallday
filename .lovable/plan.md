

## Tournament Mode — Piece 1: Database Schema

### Conflict: 3 Existing Tournament Tables

The database already has these tournament tables from a previous iteration:
- **`tournaments`** — different columns (uses `creator_id`, enum `tournament_status`, `scoring_mode`, `max_players`, `settings` JSONB; missing `description`, `num_rounds`, `start_date`, `end_date`)
- **`tournament_players`** — different columns (uses `player_name`, enum `tournament_player_role`; missing `display_name`, `handicap_override`, `team_id`)
- **`tournament_rounds`** — different columns (has `teams_data`, `games_data`, `scores`, `points_data`, `scorekeeper_id`; missing `name`, `round_date`, `notes`)

There are also 3 existing enums (`tournament_status`, `tournament_scoring_mode`, `tournament_player_role`), 2 helper functions (`is_tournament_creator`, `is_tournament_participant`), and 9 RLS policies across these tables.

**All 3 tables are empty** (zero rows). The new schema is a complete redesign with incompatible columns.

### Proposed Approach

**Drop the 3 old empty tables**, their enums, functions, and policies, then create all 13 new tables fresh. This is the only clean path — the old and new schemas are structurally incompatible (different column names, different types, different relationships).

### What the Migration Will Do

1. **Drop** old empty tables: `tournament_rounds`, `tournament_players`, `tournaments` (cascade)
2. **Drop** old enums: `tournament_status`, `tournament_scoring_mode`, `tournament_player_role`
3. **Drop** old functions: `is_tournament_creator(uuid)`, `is_tournament_participant(uuid)`
4. **Create 13 new tables**: `tournament_admins`, `tournaments`, `tournament_teams`, `tournament_players`, `tournament_rounds`, `tournament_games`, `tournament_hole_points`, `tournament_groups`, `tournament_group_players`, `tournament_hole_scores`, `tournament_hole_results`, `tournament_scoreboards`, `tournament_members`
5. **Create 3 helper functions**: `is_tournament_admin()`, `is_tournament_member(uuid)`, `is_tournament_creator(uuid)` (new signature)
6. **Enable RLS** on all 13 tables with policies per the spec
7. **Enable Realtime** on 4 tables: `tournament_hole_scores`, `tournament_hole_results`, `tournament_groups`, `tournament_rounds`
8. **Create 13 performance indexes**
9. **Create `src/types/tournament.ts`** with all TypeScript interfaces

### No Changes To
- Any non-tournament tables (`profiles`, `rounds`, `round_participants`, `saved_courses`, `saved_players`, `verified_courses`, `user_roles`, `pending_round_links`)
- Any existing components, hooks, or services
- Any existing edge functions

