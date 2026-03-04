

# Plan: Live Scorecard Enhancements (Piece 5)

This is a large feature with 7 new components, updates to the overlay hook, and a toggle system in ActiveRound. The existing tournament overlay at the bottom of ActiveRound (lines 2432-2444) gets replaced by the new tabbed system inserted between the hole card and game panels.

## Architecture

```text
ActiveRound.tsx
├── Top bar (hole nav) ── unchanged
├── [NEW] Toggle tabs (Betting | Tournament) ── only when tournamentGroupId present
├── Main scoring area ── wrapped in Betting tab visibility
│   └── all existing game panels ── zero changes
├── [NEW] Tournament tab content ── <TournamentTabPanel>
│   ├── TournamentMatchStatusBar (Section A)
│   ├── TournamentHoleTracker or TournamentSegmentTracker (Section B)
│   ├── TournamentPlayerSummary (Section C)
│   ├── TournamentPointsAnimation (banner)
│   └── Full Scorecard button → opens TournamentFullScorecard (Sheet)
└── Bottom bar (minimizable P&L) ── unchanged
```

## New Files (7 components)

### 1. `src/components/tournament/TournamentTabPanel.tsx`
Container for all tournament tab content. Props: overlay state from `useTournamentOverlay`, players, courseHoles, game config, activeHole. Stacks Sections A+B+C vertically with a "Full Scorecard" button at bottom.

### 2. `src/components/tournament/TournamentMatchStatusBar.tsx`
Prominent status card. Shows tournament name, team names with color dots, large point totals (text-3xl font-bold), status line with lead/thru/remaining. Handles all states: leading, tied, dormie, complete. For sum-of-strokes sixes, defers to segment display.

### 3. `src/components/tournament/TournamentHoleTracker.tsx`
Reverse-chronological list of completed hole results. Each row: hole number, par, team score comparison, result with color dot. Max 9 visible before scroll. Empty state placeholder. Only shows holes where ALL required scores are entered.

### 4. `src/components/tournament/TournamentPlayerSummary.tsx`
Compact table: Player | Team | Gross | Net | Pts. Running totals from engine output. Sorted by team then gross ascending. Uses `holeResults` from overlay to compute per-player aggregates.

### 5. `src/components/tournament/TournamentSegmentTracker.tsx`
Only for `tournament_sixes` + `sum_of_strokes`. Three segment cards showing running stroke totals, progress bars, and points available per segment from `sixesSegmentPoints`. Active segment has green left border, completed gets gold, not started is muted.

### 6. `src/components/tournament/TournamentFullScorecard.tsx`
Bottom sheet (using existing `Sheet` component). Horizontal-scrolling 18-hole grid with frozen player/team columns. Shows gross scores, net in parentheses if handicaps on, colored dots for hole results. Tournament result row + team totals row at bottom. Gross Best Ball highlights contributing scores.

### 7. `src/components/tournament/TournamentPointsAnimation.tsx`
Slide-down banner + count-up animation. Tracks `previousHoleCount` via ref. When new hole result appears, shows 2-second banner with team color tint. Win: "🔵 USA wins hole N +Xpt". Halved: "Hole N halved". Uses `transition-all duration-300` + `setTimeout` for auto-dismiss.

## Modified Files

### `src/hooks/useTournamentOverlay.ts`
- Expose additional state needed by new components: `tournamentGame`, `tournamentPlayers`, `teamAssignments`, `courseHoles`, `allHoleScores`
- Add `previousHoleCount` ref + `newlyCompletedHole` state for animation trigger
- Add computed `segmentTotals` for sum-of-strokes display (running stroke sums per team per segment, holes complete count)
- Return type expands to include these new fields

### `src/components/ActiveRound.tsx`
- Add `activeTab` state (`'betting' | 'tournament'`), default `'betting'`
- Add toggle tab bar between the top bar (line ~844) and the main scoring area (line ~1004), only when `tournamentGroupId` is present. Sticky positioning.
- Wrap existing main scoring area content in `{activeTab === 'betting' && ...}` — zero changes to the content itself
- Add `{activeTab === 'tournament' && <TournamentTabPanel ... />}` in the same scroll container
- Remove the old `TournamentGameOverlay` at lines 2432-2444 (replaced by new tab system)
- Toggle bar styling: segmented control matching existing app patterns, active tab `bg-primary text-primary-foreground`, inactive `bg-muted text-muted-foreground`, trophy icon uses `hsl(var(--brand-gold))`

## Edge Cases Handled
- No tournament: toggle bar doesn't render, all existing behavior unchanged
- Incomplete hole: not shown in tracker until all required scores entered
- Scramble/alternate shot: shared scores shown per team, not individual
- Match complete before 18: status bar shows win result in gold, remaining holes show "—"
- Zero scores: shows "0 — 0 • Thru 0" with empty tracker placeholder
- Sixes match play mode: renders identically to best ball (no segment UI)

## Styling
- All components use existing design system (bg-card, text-foreground, etc.)
- Team colors from `tournament_teams.color` applied via inline `style` for dots/accents
- Full scorecard grid: sticky left columns with `left-0 z-10 bg-card`, hole columns `min-w-[44px]`, `font-mono text-sm`
- Animation banner: `bg-primary/20 border-primary/40` for wins, `bg-muted/40` for halved, 2000ms duration

