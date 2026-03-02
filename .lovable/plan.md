

## Tournament Admin UI — Implementation Plan

This is a large, multi-file feature spanning ~20 new files. No existing files are modified except `App.tsx` (adding routes) and `Landing.tsx` (adding dropdown item + Tournament button). No existing tables, components, or engines are touched.

---

### Phase 1: Foundation (Hook + Guard + Routes)

**`src/hooks/useTournamentAdmin.ts`** — New hook modeled after `useAdminAuth.tsx`. Queries `tournament_admins` for the current user on load, returns `{ isTournamentAdmin, isLoading }`.

**`src/App.tsx`** — Add 5 new routes (additive only):
- `/tournament-admin` → `TournamentAdmin`
- `/tournament-admin/create` → `CreateTournamentWizard`
- `/tournament-admin/:tournamentId` → `TournamentAdminDashboard`
- `/tournament-admin/:tournamentId/scoreboards` → `TournamentAdminScoreboards`
- `/tournament-admin/:tournamentId/round/:roundId/group/:groupId` → `TournamentAdminScorecard`
- `/tournament` → Placeholder "Coming Soon" page

**`src/components/Landing.tsx`** — Two additions:
1. In the dropdown menu, after "My Players" and before the Admin Panel item: add "Tournament Admin" menu item (conditionally rendered via `useTournamentAdmin`), with a trophy icon, navigates to `/tournament-admin`.
2. After the "View Past Rounds" button: add a "🏆 Tournament" button visible to all logged-in users, navigates to `/tournament`.

---

### Phase 2: Data Hooks

**`src/hooks/useTournaments.ts`** — Fetches all tournaments where `created_by = user.id`. Provides `createTournament(data)` which inserts into `tournaments`, `tournament_teams`, `tournament_players`, `tournament_rounds`, `tournament_games`, and `tournament_hole_points` in dependency order. Also provides `updateTournament(id, updates)`.

**`src/hooks/useTournamentDetail.ts`** — Fetches a single tournament by ID along with its teams, players, rounds (with games), groups, and scoreboards. Provides granular update functions: `updateTeam`, `updatePlayer`, `addPlayer`, `removePlayer`, `updateRound`, `updateGame`, `startRound`, `completeRound`, `addScoreboard`, `updateScoreboard`, `deleteScoreboard`.

**`src/hooks/useTournamentGroups.ts`** — Fetches groups for a given round ID with their players and status. Provides `updateGroupStatus(groupId, status)`.

**`src/hooks/useTournamentScorecard.ts`** — Fetches all `tournament_hole_scores` and `tournament_hole_results` for a group. Subscribes to Supabase Realtime on both tables filtered by `tournament_group_id`. Provides `overrideScore(playerId, holeNumber, grossScore)` which upserts with `is_super_user_override = true`.

---

### Phase 3: Tournament Admin Home

**`src/pages/TournamentAdmin.tsx`**
- Guards access: redirects to `/` with toast if not tournament admin (loading skeleton while checking).
- Shows header with back arrow + "Tournament Admin" title.
- Empty state: trophy icon, "No tournaments yet", "Create Tournament" CTA.
- Tournament list: cards showing name, status badge (setup/active/completed/archived with appropriate colors and pulsing dot for active), date range, round/player count, join code with copy button, "Open Dashboard" button.
- FAB bottom-right: "+" navigates to `/tournament-admin/create`.

**`src/components/tournament-admin/TournamentCard.tsx`** — Reusable card component for the list.

---

### Phase 4: Create Tournament Wizard (5 Steps)

**`src/pages/TournamentAdminCreate.tsx`** or embedded in **`src/components/tournament-admin/CreateTournamentWizard.tsx`**
- Full-page wizard with step indicator (1–5).
- Back/Next navigation with per-step validation.

**Step components:**

**`WizardStepBasicInfo.tsx`** — Name (required), description (optional, 300 char max), start date (date picker), end date (date picker, ≥ start), number of rounds (stepper 1–10, default 2).

**`WizardStepTeams.tsx`** — List of team rows with color swatch (16 preset colors + hex input) and name input. Default: "Team A" (blue #1d4ed8) and "Team B" (red #dc2626). Add/delete team buttons. Min 2 teams.

**`WizardStepPlayers.tsx`** — Search input querying `saved_players` and `search_users_by_name` RPC. Results dropdown with "Add" button. Player list rows: name, editable handicap, team dropdown, remove button. Validation: min 2 players, all assigned to teams, each team has ≥1 player.

**`WizardStepRounds.tsx`** — One collapsible card per round. Each card contains:
- Round name (pre-filled "Round N"), date picker, course picker (reusing search logic from SetupWizard), notes textarea.
- Game type dropdown (9 tournament game types).
- Game config section: points per hole, halved hole rule (segmented), use handicaps toggle, handicap allowance slider, max score toggle+input.
- Conditional configs per game type (second ball tiebreaker, sixes segments, gross best ball info callouts).
- Per-hole point overrides (expandable, 18 inputs).
- Collapsed cards show green checkmark or red dot for completion status.

**`RoundConfigCard.tsx`** — Shared round config UI used in both wizard Step 4 and dashboard Rounds tab.

**`WizardStepReview.tsx`** — Summary of all data. "Publish Tournament" button triggers sequential inserts via `useTournaments.createTournament()`. On success: navigate to dashboard, show toast with join code.

---

### Phase 5: Tournament Admin Dashboard

**`src/pages/TournamentAdminDashboard.tsx`** — 4-tab layout using shadcn Tabs.

**Overview Tab:**
- Header: name, status badge, date range, join code box with copy.
- Live Activity: cards for active groups (group number, players, thru hole, match status, "View Scorecard" link).
- Round Status: rows per round with status pills, "Start Round"/"Complete Round" buttons.
- Scoreboard snapshot: top 3 from first scoreboard, links to manage scoreboards.

**Rounds Tab (`RoundConfigCard.tsx` reused):**
- List of rounds, each expandable showing full config.
- "Edit Round" opens inline editing (same UI as wizard Step 4).
- Warning banner if round is active.
- "View Groups" shows groups with players and status.

**Players Tab (`PlayerListAdmin.tsx`):**
- Table/card layout with name, team color dot, handicap, override badge.
- Inline handicap editing → saves to `handicap_override`.
- "Reset to original" clears override.
- "Add Player" with same search UI as wizard.

**Teams Tab (`TeamListAdmin.tsx`):**
- Card per team with editable name/color, player list.
- "Move to Team" dropdown on each player.
- Add team (max 8), delete team (only if 0 players).

---

### Phase 6: Group Scorecard View

**`src/pages/TournamentAdminScorecard.tsx`**
- Header: round name, group number, player names.
- **`MatchStatusBar.tsx`** — "USA 3 UP — Thru 12" in large text, live-updating via realtime subscription.
- Scorecard grid: Hole | Par | Player columns | Result column. Score cells show gross (large) + net (small) + asterisk if override. Result column: team color dot or "½" or "—".
- Tap any score cell → inline number input → saves with `is_super_user_override = true`.
- Running totals row at bottom.
- **`HoleResultDots.tsx`** — 18 circles filled with team color for won holes, split for halved, empty for unplayed.
- Match summary text below.

---

### Phase 7: Scoreboard Management

**`src/pages/TournamentAdminScoreboards.tsx`**
- List of scoreboards with drag-to-reorder.
- Each row: name, type, sort metric, edit/delete buttons.
- **`ScoreboardManager.tsx`** — Create/edit sheet with fields: name, type dropdown (6 types), show round breakdown toggle, sort direction segmented, sort metric dropdown. Saves to `tournament_scoreboards`.

---

### Phase 8: Tournament Coming Soon Page

**`src/pages/TournamentComingSoon.tsx`** — Simple placeholder page with trophy icon, "Coming Soon" heading, "Tournament play is on its way" subtext, back button. Shown at `/tournament`.

---

### Files Created (Summary)

```
src/hooks/useTournamentAdmin.ts
src/hooks/useTournaments.ts
src/hooks/useTournamentDetail.ts
src/hooks/useTournamentGroups.ts
src/hooks/useTournamentScorecard.ts
src/pages/TournamentAdmin.tsx
src/pages/TournamentAdminDashboard.tsx
src/pages/TournamentAdminScorecard.tsx
src/pages/TournamentAdminScoreboards.tsx
src/pages/TournamentComingSoon.tsx
src/components/tournament-admin/CreateTournamentWizard.tsx
src/components/tournament-admin/WizardStepBasicInfo.tsx
src/components/tournament-admin/WizardStepTeams.tsx
src/components/tournament-admin/WizardStepPlayers.tsx
src/components/tournament-admin/WizardStepRounds.tsx
src/components/tournament-admin/WizardStepReview.tsx
src/components/tournament-admin/RoundConfigCard.tsx
src/components/tournament-admin/TournamentCard.tsx
src/components/tournament-admin/GroupScorecardAdmin.tsx
src/components/tournament-admin/ScoreboardManager.tsx
src/components/tournament-admin/PlayerListAdmin.tsx
src/components/tournament-admin/TeamListAdmin.tsx
src/components/tournament-admin/MatchStatusBar.tsx
src/components/tournament-admin/HoleResultDots.tsx
```

### Files Modified

- **`src/App.tsx`** — Add route imports + 6 new `<Route>` entries (additive only).
- **`src/components/Landing.tsx`** — Add `useTournamentAdmin` import, "Tournament Admin" dropdown item (conditional), "Tournament" button for all logged-in users.

### No Database Changes Required

All 13 tournament tables already exist with proper RLS. The `is_tournament_admin()`, `is_tournament_creator()`, `is_tournament_member()`, and `generate_join_code()` functions are already deployed.

### Implementation Order

Due to the size, implementation will proceed in batches:
1. Hooks + routes + guard + Landing changes
2. Tournament Admin home + TournamentCard
3. Create Wizard (5 step components)
4. Dashboard (4 tabs + sub-components)
5. Scorecard view + match components
6. Scoreboard management

