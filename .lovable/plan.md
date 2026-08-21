# Show how each Award Point was won

On the Team Round Result board, the "Award points" row currently shows only the resulting points (e.g. `0 · 2 Front (2pt)`). It doesn't say why. This adds the supporting detail for each segment.

## What changes

For each round row, the Award points area becomes a small breakdown list, one line per segment:

```text
Front (2pt)    holes won 3.5 – 5.5     Team WilDonBraSah +2
Back (2pt)     holes won 4.5 – 4.5     Halved (1 each)
Overall (2pt)  holes won 7.5 – 10.5    Team WilDonBraSah +2
```

- "holes won" = the hole points each team earned in that stretch (halves count 0.5).
- The right side names the winning team and the points awarded, or "Halved (x each)" on a tie.
- Rounds still in progress show "in progress" instead of a winner, so nothing looks final early.

For rounds scored **per match** (like Round 2), each match line expands the same way with its own Front / Back / Overall sub-lines, so you can see which segment inside each match produced its points:

```text
Match 1   1 – 5
  Front (2pt)    holes won 1 – 8     Team WilDonBraSah +2
  Back (2pt)     holes won 4.5 – 4.5 Halved (1 each)
  Overall (2pt)  holes won 5.5 – 12.5 Team WilDonBraSah +2
```

Layout stays compact: the detail lines live under the round row, indented, in the same muted small type used today, and remain readable on mobile.

## Technical notes

- File: `src/components/scoreboards/TeamRoundResultScoreboard.tsx` — presentation only.
- The FBO branch already computes per-segment hole-point sums (`fa/fb`, `ba/bb`, `a/b`); keep those numbers on each segment object instead of discarding them, and render them alongside the awarded value.
- The per-match branch uses `calcRoundMatchAward`, whose returned rows already carry `segments` with `label`, `holesA`, `holesB`, `value` (the same data `TestRoundAwardCard` renders). Surface those instead of only `awardA` / `awardB`.
- No scoring-logic or backend changes; award totals and grand totals are untouched.
