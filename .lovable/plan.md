

# Tournament Mode — Piece 3: Player Tournament Entry Flow

## Overview

Build the complete player-facing tournament experience: join via code, view scoreboards (placeholder), 7-step round setup wizard, tournament game overlay during active rounds, and tournament-aware round submission. All additive — no modifications to existing core components.

## New Files (19 files)

### Pages
- `src/pages/Tournament.tsx` — Player hub with join code entry + "My Tournaments" list
- `src/pages/TournamentScoreboards.tsx` — Read-only scoreboard view with tabs

### Components
- `src/components/tournament/TournamentJoinCard.tsx` — Join code input, lookup, result display
- `src/components/tournament/TournamentMyTournaments.tsx` — List of joined tournaments
- `src/components/tournament/TournamentRoundCard.tsx` — Selectable round card for Step 2
- `src/components/tournament/TournamentRulesCallout.tsx` — Reusable amber/gold rules callout box
- `src/components/tournament/TournamentPlayerSelector.tsx` — Player selection list (Step 4)
- `src/components/tournament/TournamentTeamAssigner.tsx` — Team assignment UI (Step 5)
- `src/components/tournament/TournamentGameOverlay.tsx` — Tournament panel on ActiveRound
- `src/components/tournament/TournamentMatchTracker.tsx` — 18-dot match status + points summary
- `src/components/tournament/TournamentRoundSummary.tsx` — Summary panel on RoundSummary
- `src/components/tournament/TournamentScoreboardTabs.tsx` — Tab structure with placeholder content
- `src/components/tournament/TournamentBuildRoundWizard.tsx` — Full 7-step wizard container with progress bar

### Hooks
- `src/hooks/useTournamentRoundSetup.ts` — Wizard state management across all 7 steps
- `src/hooks/useTournamentScoreboards.ts` — Scoreboard data fetching + realtime subscriptions
- `src/hooks/useTournamentOverlay.ts` — Tournament game state during active round (score sync, match tracking)
- `src/hooks/useTournamentEntry.ts` — Join code lookup, tournament_members insert, my tournaments query

## Modified Files (3 files)

### `src/App.tsx`
- Add imports for `Tournament`, `TournamentScoreboards`, and `TournamentBuildRoundWizard`
- Add routes: `/tournament`, `/tournament/:joinCode/scoreboards`, `/tournament/:joinCode/build-round`
- Replace the `TournamentComingSoon` route

### `src/components/ActiveRound.tsx`
- Import and render `TournamentGameOverlay` when `tournamentGroupId` is present in location state
- Add it as a collapsible section below existing game panels — no changes to existing logic

### `src/components/RoundSummary.tsx`
- Import and render `TournamentRoundSummary` when `tournamentGroupId` is in location state
- On finish, also update `tournament_groups.status` to `'submitted'` and set `submitted_at`

## Database Changes

No new tables needed. One potential migration:
- Add an `INSERT` RLS policy on `tournament_group_players` and `tournament_groups` for tournament members (currently only creator has write access). Players need to create their own groups and group_players when building a round.
- Add `INSERT` + `UPDATE` policy on `tournament_hole_scores` — already exists for group members via the existing policies.

```sql
-- Allow tournament members to create groups for rounds they participate in
CREATE POLICY "Members can create groups"
ON public.tournament_groups FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_rounds tr
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tr.id = tournament_groups.tournament_round_id
    AND tm.user_id = auth.uid()
  )
);

-- Allow tournament members to update their own groups (status → submitted)
CREATE POLICY "Members can update own groups"
ON public.tournament_groups FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournament_group_players tgp
    JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
    WHERE tgp.tournament_group_id = tournament_groups.id
    AND tp.user_id = auth.uid()
  )
);

-- Allow tournament members to add group players
CREATE POLICY "Members can create group players"
ON public.tournament_group_players FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tg.id = tournament_group_players.tournament_group_id
    AND tm.user_id = auth.uid()
  )
);
```

## Implementation Details

### Wizard Flow (TournamentBuildRoundWizard.tsx)

7-step full-screen wizard with progress bar. State managed by `useTournamentRoundSetup`:

1. **Tournament Confirm** — Show tournament name, description, user's team assignment, round progress
2. **Select Round** — Vertical list of tournament rounds as selectable cards with status badges, expandable rules detail panel
3. **Confirm Course + Game** — Read-only display of course info, game type, rules in amber callout
4. **Choose Players** — All tournament players listed, current user pre-selected and locked, enforce exact player count per game type, duplicate group warning via `tournament_group_players` check
5. **Assign Teams** — Show team assignments (read-only, pre-populated from `tournament_players.team_id`), visual "vs" divider. Skipped for scramble formats
6. **Side Games** — Reuse existing `GAME_LIBRARY` cards and configuration from SetupWizard (extracted as shared data). "No Side Games" option to skip
7. **Review + Start** — Summary card with all selections, "Start Round" button

### Round Creation Sequence (on "Start Round")

1. Insert into `rounds` table (existing system) with `course_data` from tournament round, mapped players, side games
2. Insert `round_participants` for linked players
3. Insert into `tournament_groups` with `round_id` linking to the new round
4. Insert into `tournament_group_players` for each selected player
5. Navigate to `/active` with state `{ tournamentGroupId }`

### Tournament Game Overlay (ActiveRound addition)

- Collapsible panel below existing game panels, default expanded
- Header with trophy icon and tournament/round name
- `TournamentMatchTracker`: 18 colored dots for hole results, match status text ("USA 2 UP — Thru 8"), points summary
- Score sync: when scores are written to `rounds.scores`, also upsert to `tournament_hole_scores`. Hole result calculation left as TODO comment for Piece 4
- Player mapping: resolve `tournament_player_id` from `tournament_group_players` using `user_id` match, passed via route state

### Tournament Round Summary (RoundSummary addition)

- Additional card above finish button showing match result and final points
- On "Finish Round", also: update `tournament_groups.status = 'submitted'`, set `submitted_at`, show tournament toast

### Scoreboard Page

- Tab structure from `tournament_scoreboards` ordered by `display_order`
- Each tab renders placeholder: "[Name] — Live scoreboards coming in a future update."
- `useTournamentScoreboards` sets up realtime subscriptions on `tournament_hole_scores` and `tournament_hole_results` — data fetching skeleton ready for Piece 6
- "Live" badge when any round has `status = 'active'`

### Styling

- Tournament accent: `hsl(var(--brand-gold))` for headers, trophy icons
- Rules callout: `border-l-4 border-yellow-500 bg-yellow-950/30`
- Hole result dots: 18px circles with team colors, gray for unplayed
- Live badge: green pulsing dot
- Wizard: full-screen steps, `pb-24` scroll container, fixed bottom action buttons

