# Plus handicaps across the betting games

## How it works today

- **Relative handicap games** (Banker, Bloody Banker, Team Banker, Wolf, Nine Points, Skins, Nassau, Hammer, and FBO set to "lowest handicap = 0"): already correct. The best player in the group — including a plus player — is the zero mark and everyone else gets the difference.
- **Full handicap games** (6's or 3's, Stockton 6's, FBO set to full handicap): a plus player is treated as scratch. No strokes are added back, so a +2 player plays even.
- **Net numbers shown on scorecards** do add strokes back on the easiest holes for a plus player, so the printed net can disagree with the hole winner in full handicap games.
- **Entering a plus handicap**: only works by typing a negative number (-2.4). A GHIN plus index comes back as "+2.4" and is read as 2.4 — the wrong direction, making the player worse instead of better.

## What to change

1. Full handicap games add strokes back for plus players: a +2 player has one stroke added to their score on the two easiest holes (stroke index 18 and 17), a +1 on the easiest hole. This makes the hole winners match the net numbers already shown.
2. Every game keeps its existing behaviour for scratch and normal handicaps — no change to how anyone else is stroked, and no change to payouts beyond the corrected hole results.
3. Plus handicaps become enterable properly: profile, saved players, tournament player handicaps, admin handicap edits and tournament registration all accept "+2.4" and display it back as "+2.4" instead of "-2.4".
4. GHIN sync reads plus indexes with the correct sign, both on manual sync and the nightly refresh, so a plus player stops being imported as a high handicap.
5. Scorecards mark the give-back holes distinctly from stroke-received holes so it's obvious where a plus player is adding a shot.

## Technical notes

- `calculateGameStrokes` and `calculateFBOStrokes` in `src/services/gameEngine.ts` gain negative-handicap handling in their absolute branch, returning negative strokes on the easiest indexes, mirroring the logic already in `calculateStrokesReceived`. Relative branches are unchanged.
- Call sites that assume strokes are 0 or more get checked: `src/services/sixesEngine.ts`, `stockton6Engine.ts`, `teamBankerEngine.ts`, `hammerEngine.ts`, plus the scorecard components that render stroke dots.
- Manual stroke overrides currently clamp to 0-3; the clamp widens to -3..3 so a plus player's give-back can be overridden.
- Input handling: a shared parse/format helper for "+x.x" used by `src/pages/Profile.tsx`, `src/pages/Players.tsx`, `src/pages/TournamentRegistration.tsx`, the tournament player/handicap editors, and `src/components/SetupWizard.tsx`. Storage stays numeric and negative — no migration needed; the existing -10 lower bound on the database check already allows plus indexes.
- GHIN sign fix in `supabase/functions/_shared/ghin.ts` (and anything that parses the returned index string).
