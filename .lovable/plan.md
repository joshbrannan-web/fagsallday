

## Plan: Fix Duplicate Players, Add Course Selection to Step 1, Restructure Step 3, Add Scorekeeper Links

### Bug Fix: Duplicate player in Add Round

In `CreateTournamentWizard.tsx` `handleCreate`, the creator is added as `super_user` inside `createTournament` (line 132 of `useTournament.tsx`), then all wizard players are inserted again via `addPlayers` (line 306). If the creator is in the wizard player list, they get added twice.

**Fix in `CreateTournamentWizard.tsx`**: Filter out the creator's `user_id` from `playerRows` before calling `addPlayers`, since `createTournament` already inserts them as `super_user`.

---

### Step 1: Add per-round course selection after dates

After the user picks start/end dates, show a section for each round (1 through `numRounds`) where they select a course. Reuse the same course selection patterns from `SetupWizard.tsx`:
- Search verified library (`searchVerifiedCourses`)
- Search web via `search-course` edge function
- Select from saved courses
- Scan scorecard image

**State**: Add `roundCourses: (Course | null)[]` state array sized to `numRounds`. Each round gets a mini course-finder inline (search input + results + saved course badges). Store selected courses so Step 3 can reference them.

**Validation**: Step 1 requires name + at least round 1 has a course selected.

**Files**: 
- `CreateTournamentWizard.tsx` — add course selection UI per round in Step 1, import `searchCourse`, `fetchCourseDetails`, `courseDataToCourse` from `@/lib/api/courseSearch`, `useVerifiedCourses`, and `useSavedCourses`

---

### Step 3: Restructure to match non-tournament SetupWizard game selection

Step 3 currently has tournament-specific game types (Stableford, Stroke Play, etc.). Replace with the actual game library from `SetupWizard.tsx` (Banker, Skins, Nassau, FBO, Wolf, etc.). Each round accordion should:
- Show the course name (from Step 1) in the header
- Allow selecting games from `GAME_LIBRARY` (same list as `SetupWizard`)
- Configure matchup format (1v1, 2v2, 4v4, FFA) and blind teams toggle
- Allow assigning players to matchups/tee times within the round

**Data model update**: `RoundConfig.games` should store the same `GameSettings` format used by regular rounds, not `TournamentGameConfig`. Update `tournamentScoringEngine.ts` types accordingly. Keep `TournamentGameConfig` for backward compat but `RoundConfig` uses `GameSettings[]`.

**Files**:
- `CreateTournamentWizard.tsx` — import `GAME_LIBRARY` items, render game cards per round
- `tournamentScoringEngine.ts` — update `RoundConfig` type

---

### Scorekeeper links per round

When the super user starts a round from `TournamentRoundView.tsx`:
- Before starting, show a "Tee Times" setup where the super user assigns players to groups and picks one scorekeeper per group
- On "Start Round", generate shareable links for each scorekeeper (similar to `generate-round-links` edge function pattern)
- Each scorekeeper link grants them `scorekeeper_id` access on that specific `tournament_round`

**Implementation**:
- Create new edge function `supabase/functions/generate-tournament-round-links/index.ts` that:
  - Takes `round_id` and `tee_times: [{scorekeeper_user_id, player_ids}]`
  - For each scorekeeper with a `user_id`, generates a magic link redirecting to `/tournament/:id/round/:roundId`
  - Returns shareable text with links
- Update `TournamentRoundView.tsx`:
  - When status is `SETUP`, show tee time configuration UI (group players, pick scorekeeper per group)
  - Store tee times in `tournament_rounds.teams_data` jsonb
  - "Start Round & Generate Links" button calls the edge function and shows share sheet
- Update `useTournament.tsx`: add `updateRoundTeeTimes` method

**Files**:
- `supabase/functions/generate-tournament-round-links/index.ts` — new edge function
- `src/pages/TournamentRoundView.tsx` — tee time setup + link generation UI
- `src/hooks/useTournament.tsx` — helper methods

---

### Summary of files to modify/create:
1. **`src/pages/CreateTournamentWizard.tsx`** — fix duplicate player bug, add course selection to Step 1, restructure Step 3 game selection
2. **`src/services/tournamentScoringEngine.ts`** — update RoundConfig types
3. **`src/pages/TournamentRoundView.tsx`** — tee time setup with scorekeeper selection + link generation
4. **`src/hooks/useTournament.tsx`** — fix duplicate player, add tee time helpers
5. **`supabase/functions/generate-tournament-round-links/index.ts`** — new edge function for scorekeeper links

