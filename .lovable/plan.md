

# Plan: Fix All Critical Failures & Feature Gaps

11 FAIL + 7 PARTIAL items across 5 files. Grouped by file for efficient implementation.

---

## 1. `src/hooks/useTournamentOverlay.ts` — Realtime + Animation Fix

**Fixes: #59, #67, #68**

**Realtime (#67, #68):** Add a Supabase realtime subscription to `tournament_hole_scores` and `tournament_hole_results` filtered by `tournament_group_id`. On any `INSERT` or `UPDATE` event, re-fetch scores and results, re-run the engine, and update state. This ensures all group members see live updates.

```text
useEffect(() => {
  if (!tournamentGroupId) return;
  const channel = supabase.channel(`overlay-${tournamentGroupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_scores', filter: `tournament_group_id=eq.${tournamentGroupId}` }, () => reload())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_hole_results', filter: `tournament_group_id=eq.${tournamentGroupId}` }, () => reload())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [tournamentGroupId]);
```

Extract the data-loading logic from the existing `useEffect` into a `reload()` callback so both initial load and realtime events share it.

**Animation filter (#59):** Change line 246 from `hr.resultLabel && hr.pointsValue > 0` to `hr.resultLabel && hr.resultLabel !== ''`. This ensures halved holes with `no_points` rule (pointsValue=0) still trigger the animation banner.

---

## 2. `src/components/tournament/TournamentHoleTracker.tsx` — Score Comparison + No-Points Label

**Fixes: #17, #20**

**Team score comparison (#17):** Add a middle column between hole info and result. Use `grossScores`/`netScores` from `holeResults` to compute per-team best net (for match play/best ball), sum (for gross best ball), or team score (for scramble). Display as `"USA 3 / EUR 4"`.

**No-points label (#20):** Change the `isNoPoints` display from `"No pts"` to `"½ No pts"`.

---

## 3. `src/components/tournament/TournamentFullScorecard.tsx` — Column Alignment + Points Row + Halved Display + Header

**Fixes: #40, #46, #49, #50, #52, #53**

**Header (#40):** Change `SheetTitle` from "Full Scorecard" to show `tournamentName — roundName` and pass those as new props.

**Result row alignment (#49):** Split the result row iteration into `frontNine.map(...)` + OUT td + `backNine.map(...)` + IN td + TOT td, matching the header column structure exactly.

**Points row (#50):** Add a new `<tr>` below the result row showing numeric points per hole (`pointsValue`), with OUT/IN/TOT summing team points.

**Halved indicator (#46):** When a hole is halved (`aPts === bPts && aPts > 0`), render `"½"` text instead of a gray dot.

**Scramble/Alternate Shot (#52):** Detect game types `scramble_*` or `alternate_shot_*`. For those, show a small "T" superscript next to scores indicating team score.

**Gross Best Ball contributing scores (#53):** For `match_play_gross_best_ball`, compare each player's gross against the best N scores used. Bold contributing scores, mute non-contributing ones.

---

## 4. `src/components/tournament/TournamentMatchStatusBar.tsx` — Match Complete Banner + Count-Up

**Fixes: #58, #61**

**Match complete banner (#61):** When `matchState?.isComplete`, render an additional gold banner below the status card: `"Match Complete 🏆 [Team] wins [X]pts to [Y]pts"` (or "Match Halved"). Style: `bg-yellow-500/20 border-yellow-500/40 text-yellow-600`.

**Count-up animation (#58):** Wrap the points numbers in a `<span>` with CSS `transition: all 0.3s` and use a key based on the points value to trigger re-render animation via `animate-scale-in`.

---

## 5. `src/components/tournament/TournamentHoleTracker.tsx` — Unplayed Holes After Match Complete

**Fix: #62**

When `matchState?.isComplete`, append remaining unplayed holes (those without results) to the tracker as muted "—" rows, showing "Hole N • Par X • —" to indicate they weren't played.

---

## 6. `src/components/tournament/TournamentPlayerSummary.tsx` — Points Accumulation Fix

**Fix: #28 (PARTIAL)**

The current code assumes `playerPoints` is cumulative by taking the last value. Instead, sum `playerPoints[playerId]` across all hole results: `ptsTotal += pp`.

---

## 7. Minor Partials (low priority, bundled in)

- **#7**: Add `style={{ fontVariantCaps: 'small-caps' }}` to the tournament name text in `TournamentMatchStatusBar`
- **#12**: Remove `[Team] leads •` prefix from dormie line to match spec: `"Dormie • [N] pts left"`
- **#21**: No code change needed — engine already guarantees results only when all scores present
- **#27/#28**: Net total fix already covered above

---

## Files Modified (summary)

| File | Changes |
|------|---------|
| `useTournamentOverlay.ts` | Add realtime subscription, fix animation filter |
| `TournamentHoleTracker.tsx` | Add team score column, fix no-points label, add unplayed holes for complete matches |
| `TournamentFullScorecard.tsx` | Fix column alignment, add points row, halved text, header info, scramble/GBB formatting |
| `TournamentMatchStatusBar.tsx` | Add match complete banner, count-up animation, small-caps, dormie text |
| `TournamentPlayerSummary.tsx` | Fix points accumulation to sum instead of last-value |
| `TournamentTabPanel.tsx` | Pass `matchState` + `tournamentName`/`roundName` to scorecard |

No new files. No database changes.

