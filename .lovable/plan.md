

# Plan: Tournament Mode Code Cleanup

Findings and fixes across tournament files. No database changes. No new files.

---

## 1. Remove Dead Components

Two components are no longer imported anywhere and contain placeholder text:

- **`src/components/tournament/TournamentScoreboardTabs.tsx`** — contains "Live scoreboards coming in a future update." Not imported. Delete entire file.
- **`src/pages/TournamentComingSoon.tsx`** — contains "Coming Soon" placeholder. Not imported. Delete entire file.

---

## 2. Hardcoded "Team A" / "Team B" Labels in Engine

`src/services/tournamentEngine.ts` uses hardcoded "Team A wins" / "Team B wins" in result labels at 6 locations (lines ~280, 284-285, 373-374, 450-451, 602-603). These labels are written to the database and displayed on scoreboards.

**Fix**: The engine doesn't have access to team names (it receives teamIds, not names). Change these labels to use a neutral pattern that the UI can resolve:
- `"Team A wins"` → Use the team position contextually. Since the UI already shows team dots/colors based on `teamPoints` data, change labels to just `"wins"` with team identification via the `teamPoints` keys. However, this would break the existing display.

**Better approach**: Pass team names into the engine. Add an optional `teamNames: Record<string, string>` to `EngineInput`. Where available, use actual names; where not, fall back to "Team A"/"Team B". Update the 6 call sites in the engine and the 2 callers (`useTournamentScorecard`, `useTournamentOverlay`) to pass team names.

---

## 3. Hardcoded "Team A" / "Team B" Fallbacks in UI Components

These are legitimate null-safety fallbacks (`teamA?.name || 'Team A'`) — they only display when team data is missing. These are acceptable defensive coding. **No change needed.**

---

## 4. TODO Comment in TournamentAdminDashboard

Line 56: `// TODO: merge hole_points rows`

The `holePointOverrides` are already properly fetched and merged in `useTournamentScorecard` and `useTournamentOverlay` (the actual scoring paths). This TODO is in a preview/display helper in the admin dashboard that doesn't run the engine for scoring. **Remove the TODO and add a clarifying comment**: `// hole_points handled by scoring hooks; admin preview uses defaults`.

---

## 5. `any` Types in Scoreboard Components

Multiple scoreboard components use `any` extensively. The most egregious:

- **`ScoreboardRenderer.tsx`** — `scoreboard: any; data: any` props
- **`IndividualRoundResultScoreboard.tsx`** — all props are `any[]` or `Record<string, any[]>`
- **`useTournamentScoreboards.ts`** — all state typed as `any[]`

**Fix**: Create a shared set of lightweight interfaces in the scoreboard files (or reference existing types from `tournament.ts`) for the common shapes: round, team, player, group, groupPlayer. Then type the hook return and component props. This is a large scope item — focus on the 3 most impactful files:
- `useTournamentScoreboards.ts` — type the return object
- `ScoreboardRenderer.tsx` — type the `data` prop as the hook's return type
- `IndividualRoundResultScoreboard.tsx` — type props with specific interfaces

---

## 6. `TournamentMatchTracker` Component — Superseded?

`TournamentMatchTracker.tsx` is imported only by `TournamentGameOverlay.tsx` and `TournamentRoundSummary.tsx`. The Piece 5 work introduced `TournamentHoleTracker` and `TournamentMatchStatusBar` as replacements. `TournamentMatchTracker` is still actively used in those two files so it stays. **No change.**

---

## 7. Unused Import Check

Quick scan of `CreateTournamentWizard.tsx` default team values:
```ts
const [teams, setTeams] = useState<TeamData[]>([
  { name: 'Team A', color: '#1d4ed8' },
  { name: 'Team B', color: '#dc2626' },
]);
```
These are **default placeholder values** for the creation form — user replaces them. This is correct behavior. **No change.**

---

## Summary of Changes

| File | Action |
|------|--------|
| `TournamentScoreboardTabs.tsx` | Delete (dead code, placeholder text) |
| `TournamentComingSoon.tsx` | Delete (dead code, placeholder text) |
| `tournamentEngine.ts` | Replace 6 "Team A/B wins" labels with dynamic team names from new `teamNames` param on `EngineInput` |
| `types/tournament.ts` | Add optional `teamNames` to `EngineInput` interface |
| `useTournamentScorecard.ts` | Pass `teamNames` to engine |
| `useTournamentOverlay.ts` | Pass `teamNames` to engine |
| `TournamentAdminDashboard.tsx` | Remove TODO, add clarifying comment |
| `useTournamentScoreboards.ts` | Add return type interface, replace `any` state types |
| `ScoreboardRenderer.tsx` | Type `data` prop with hook return type |
| `IndividualRoundResultScoreboard.tsx` | Replace `any` props with typed interfaces |

10 files modified, 2 files deleted, 0 new files, 0 database changes.

