# Fix two tournament round setup bugs

Verified in code: `RoundConfigCard` collects `sixesFormat` / `sixesSegmentPoints`, but neither appears in the wizard payload, the `tournament_games` insert in `useTournaments.ts`, or `saveRoundEdits`. And `defaultRoundConfig` seeds `holePointOverrides: Array(18).fill(1)` with no re-sync when Points Per Hole changes, while the wizard writes every hole differing from the default. `dbToRoundConfig` explicitly ignores stored hole points.

## Bug 1 — Sixes format and segment points never saved

- **Wizard payload** (`CreateTournamentWizard.tsx`): add `sixesFormat` and `sixesSegmentPoints` to the `game` object, only for `tournament_sixes`.
- **Create hook** (`useTournaments.ts`): extend the `game` input type with `sixesFormat?: 'match_play' | 'sum_of_strokes'` and `sixesSegmentPoints?: [number, number, number]`; write `sixes_format` (default `'match_play'`) and `sixes_segment_points` (default `[1,1,1]`) in the `tournament_games` insert.
- **Edit round-trip** (`TournamentAdminDashboard.tsx`): read `sixes_format` / `sixes_segment_points` in `dbToRoundConfig`; write both in the `updateGame` call inside `saveRoundEdits`.
- **Visibility**: where round settings are summarised (Review step and the dashboard round card), print e.g. `Sixes: Sum of Strokes · 2/2/3 pts` when the game type is `tournament_sixes`.

## Bug 2 — Hidden hole-point overrides silently override Points Per Hole

- **Opt-in flag**: add `holePointsCustomized: boolean` to `RoundConfigData`, default `false` in `defaultRoundConfig`. Set to `true` only in the H1–H18 input `onChange`, setting `holePointOverrides` and the flag in one `onChange` call.
- **Keep the panel honest**: in the `defaultPointsPerHole` update handler (not an effect), when `holePointsCustomized` is false, reset `holePointOverrides` to `Array(18).fill(newDefault)`.
- **Wizard**: send `holePointOverrides` only when `holePointsCustomized` is true; otherwise send `[]`.
- **Make it visible**: collapsible trigger shows a count when customised (e.g. "Customize hole points (3 holes customised)"); Review step shows the same line.
- **Editable after publish** (`TournamentAdminDashboard.tsx`):
  - `dbToRoundConfig` loads stored `tournament_hole_points` into `holePointOverrides` and sets `holePointsCustomized: true` when any row exists — fetching the rows for the round's game when opening the editor if the dashboard doesn't have them.
  - `saveRoundEdits` deletes all `tournament_hole_points` rows for that `tournament_game_id`, then inserts only holes differing from `default_points_per_hole`. Clearing a customisation is then possible and stale sets self-heal on save.

## Not changing

- `tournamentEngine.ts` and `holePointValue` precedence stay as-is.
- No scoring-math, hole-scores table, or round persistence / sync changes.
- No migration — `sixes_format`, `sixes_segment_points`, and `tournament_hole_points` already exist.

## Files

- `src/components/tournament-admin/RoundConfigCard.tsx`
- `src/components/tournament-admin/CreateTournamentWizard.tsx`
- `src/components/tournament-admin/WizardStepReview.tsx` (summary lines)
- `src/hooks/useTournaments.ts`
- `src/pages/TournamentAdminDashboard.tsx`
