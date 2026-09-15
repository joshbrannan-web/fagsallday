# Why hole 9 was a tie, and how to fix it

## What the data shows

Alpine Country Club round, still active. Josh (course handicap 9, White) vs CB / Clint Berry (course handicap 16, Blue), head-to-head Front/Back/Overall at $10 a segment. Hole 9 is stroke index 4; both players shot 4. Josh's front press starts on hole 9, so hole 9 alone decides that press. The saved result for hole 9 is "no dot" (halved), so the press pushed.

The reason: this round's Front/Back/Overall game was saved with the handicap style **"Full handicap"** (the current default when nothing is chosen). In that style each player gets a stroke on every hole at or below their own handicap — hole 9 is index 4, so Josh (9) gets one and Clint (16) gets one — and when **every** player in the matchup is due a stroke, the strokes cancel. Net 4 vs net 4, halved.

Under the other style, **"Lowest handicap = 0"**, Clint plays off the 7-stroke difference and gets his strokes on the 7 hardest holes — index 4 included. Net 3 vs net 4: Clint wins hole 9 and wins the front press. So your reading of the hole is right; the round is simply set to the other handicap style.

Also worth knowing: the other game in this round (Team Banker) is set to "Lowest handicap = 0", so the two games are scoring strokes differently on the same holes.

## The fix

1. Switch this round's Front/Back/Overall game to "Lowest handicap = 0" so Clint gets his stroke on hole 9. Every hole dot, the Front/Back/Overall results and the two presses recalculate from that.
2. Make "Lowest handicap = 0" the default for new Front/Back/Overall games, matching every other game in the app, so this mismatch can't happen again by accident.
3. On the round's Front/Back/Overall view, show a one-line note naming the handicap style in force (e.g. "Lowest handicap = 0 — Clint gets 7 strokes"), so it's obvious which rule the dots follow.

No change to the press rules or the payout math themselves.

## Technical notes

- `src/lib/gameLibrary.ts`: the FBO entry has no `fbo.handicapMode`, and `calculateFBOStrokes` in `src/services/gameEngine.ts` falls back to `'absolute'` — add `handicapMode: 'relative'` to the FBO default config.
- Existing round `ea945ba5-9160-4382-beda-dc44a099a284`: set `games_data -> FBO-1789412939649 -> config.fbo.handicapMode = 'relative'`, then let the client recompute `matchupDots` (dots are stored per hole in `game_data`, so stale dots for holes 1-18 need recalculating rather than being trusted).
- Handicap-style label rendered from `game.config.fbo?.handicapMode` in the FBO status/summary component.
