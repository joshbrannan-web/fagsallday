

# Plan: Fix All Failures & Partials from Piece 6 Audit

15 items to fix across 7 files. No new files. No database changes.

---

## 1. `src/pages/TournamentScoreboards.tsx` — Header & Completion Banner

**Fixes: #3 (round progress when no rounds started), #91 (completion banner missing winner)**

- **#3**: Show "Round 0 of N — Not started" when no rounds have started (currently shows nothing)
- **#91**: Change completion banner from `"🏆 Tournament Complete"` to include winning team: `"🏆 [Team] wins [X] — [Y]"` or `"🏆 Tournament Complete — Tied"`. Compute team totals from holeResults inline.

---

## 2. `src/components/scoreboards/TeamPointsBreakdownTable.tsx` — Group Result Labels

**Fix: #16**

Change badge from generic `✓` / `½` to full text: `"USA wins"`, `"EUR wins"`, or `"Halved"`. The `resultLabel` variable already computes this on line 106 — just use it instead of the ternary with checkmarks.

---

## 3. `src/components/scoreboards/RyderCupGraphic.tsx` — Winner Banner Score

**Fix: #19**

Change line 75 from `"🏆 {leadingTeam.name.toUpperCase()} WINS"` to `"🏆 {leadingTeam.name.toUpperCase()} WINS {totalA} — {totalB}"`.

---

## 4. `src/components/scoreboards/IndividualGrossScoreboard.tsx` — Round Column Visibility

**Fix: #22**

Change `startedRounds` filter from `r.status !== 'pending'` to only include rounds that have at least one score in `holeScores`. Check if any `holeScores` entry belongs to a group in that round.

---

## 5. `src/components/scoreboards/IndividualRoundResultScoreboard.tsx` — Match Result Margins

**Fixes: #53, #58**

- **#53**: After determining W/L/H, compute match margin from the group's hole results. Count holes with results. If match ended early (myPts or oppPts mathematically clinched), show margin as `"W (X&Y)"` where X is point lead and Y is holes remaining. For completed matches going to 18, show `"W (XUP)"`. For halved, just show `"H"`.
- **#58**: Use team_points comparison to determine margin. Calculate: lead amount and holes remaining to produce match-play style result text like `"3&2"`, `"2UP"`, `"1UP"`.

---

## 6. `src/pages/TournamentGroupScorecard.tsx` — Match Tracker & Status Bar

**Fix: #61**

Import and render `TournamentMatchStatusBar` (from Piece 5) and a simple match tracker dots row. Run the tournament engine or compute match state from `results` data to show:
- Status bar with team points tally and lead text
- Dot tracker showing which team won each completed hole

The component already has `teams`, `results`, and team totals computed. Add a status section between the header and scorecard table showing the match status (lead, thru, points remaining) and colored dots per hole.

---

## 7. `src/components/scoreboards/TournamentLiveToast.tsx` — Lead Change Detection & Match Complete

**Fixes: #68, #71, #73**

- **#68**: Track previous team totals (before the new result) to distinguish "takes the lead" vs "extends lead". Store previous totals in a ref. Compare old leader vs new leader:
  - Same leader, bigger margin → "[Team] extends lead"
  - New leader → "[Team] takes the lead"
  - Was leading, now tied → "Match level"
- **#71**: Clear any existing timeout before setting a new one. Use a `timeoutRef` to ensure proper cleanup.
- **#73**: Detect when all rounds are complete or when totals indicate a winner. Show `"🏆 [Team] wins! Final: [X] to [Y]"`.

---

## 8. `src/hooks/useTournamentScoreboards.ts` — Return holePoints & Incremental Update

**Fixes: #82, #83**

- **#82**: `holePoints` is already fetched and in state (line 134) — it's already returned. This was a false flag in the audit; verify it's actually in the return. Looking at line 134: `holePoints` IS in the return. No change needed.
- **#83**: Replace the full `fetchScoresAndResults` call on realtime events with an incremental update. On `tournament_hole_scores` event, upsert the single changed row into `holeScores` state. On `tournament_hole_results` event, upsert the single changed row into `holeResults` state. Only fall back to full refetch for DELETE events.

---

## 9. `src/services/scoreboardCalculations.ts` — calcThru Returns 0

**Fix: #79**

Change line 205 from `return scores.length || null` to `return scores.length > 0 ? scores.length : null`. This is actually equivalent for the "not started" case — 0 scores means the player hasn't started, which should show "—". The current behavior is correct. No change needed.

---

## Summary of Actual Changes

| File | Fixes |
|------|-------|
| `TournamentScoreboards.tsx` | #3, #91 — round progress empty state, completion banner with winner |
| `TeamPointsBreakdownTable.tsx` | #16 — full result text instead of ✓/½ |
| `RyderCupGraphic.tsx` | #19 — winner banner includes score |
| `IndividualGrossScoreboard.tsx` | #22 — round columns only when scores exist |
| `IndividualRoundResultScoreboard.tsx` | #53, #58 — match margin in parentheses |
| `TournamentGroupScorecard.tsx` | #61 — add match status bar and hole result dots |
| `TournamentLiveToast.tsx` | #68, #71, #73 — lead change detection, timeout cleanup, match complete message |
| `useTournamentScoreboards.ts` | #83 — incremental realtime updates |

8 files modified, 0 new files, 0 database changes.

