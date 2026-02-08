
## Add "Share Scorecard" Button to Round Complete Page

### What Changes
Add a "Share Scorecard" button to the Round Summary page (`src/components/RoundSummary.tsx`) that generates and shares a PNG image of the full 18-hole scorecard -- identical to the "Share Image" button on the Scorecard page.

### Approach
Rather than duplicating the ~200 lines of hidden scorecard markup and all the helper functions, extract the shared logic into a reusable component that both pages can use.

### Files Changed

**1. New file: `src/components/ScorecardImage.tsx`**

Extract the hidden scorecard container and the share handler into a standalone component:

- Accept `currentRound`, `roundTotals`, and game engine helpers as props
- Render the hidden `div` (fixed, opacity-0, 1200px wide) with the full 18-hole table using inline styles (same markup currently at lines 1290-1486 of Scorecard.tsx)
- Expose a `ref` or imperative handle so the parent can trigger the image capture
- Include the `handleShareImage` function that calls `toPng` from `html-to-image`, converts to blob, and uses `navigator.share` or falls back to download

The component will use `React.forwardRef` with `useImperativeHandle` to expose a `shareImage()` method that parents can call.

**2. Update: `src/components/Scorecard.tsx`**

- Remove the hidden scorecard container JSX (lines 1290-1486)
- Remove the `scorecardRef` and `handleShareImage` function
- Import and render `ScorecardImage`, passing the round data
- Wire the "Share Image" button to call the component's `shareImage()` method via ref

**3. Update: `src/components/RoundSummary.tsx`**

- Import `ScorecardImage` component
- Import required game engine helpers (`calculateAggregatedHolePnL`, `calculateBanker`, score/money helpers)
- Render the `ScorecardImage` component (hidden, same as Scorecard page)
- Add a "Share Scorecard" button in the bottom action bar, next to the existing "Share" (text) and "View Scorecard" buttons
- Wire the button to call `shareImage()` via ref
- Add `Image` icon from lucide-react for the button

### Button Placement

The bottom action bar currently has two buttons in a row: "Share" and "View Scorecard". The new layout will be three buttons in a row:

```
[ Share ]  [ Share Scorecard ]  [ View Scorecard ]
```

All three use `variant="outline"` and `flex-1` for equal width.

### Technical Details

The `ScorecardImage` component needs these calculations internally (moved from Scorecard.tsx):
- `calculateAggregatedHolePnL` for per-hole money
- `getBankerForHole` for crown icons
- `calculateRelativeStrokes` for stroke dots
- `calculateTotalScore` for the total column
- Score styling logic (birdie circles, bogey squares, etc.)

The component signature:

```typescript
export interface ScorecardImageHandle {
  shareImage: () => Promise<void>;
}

interface ScorecardImageProps {
  currentRound: Round;
  roundTotals: Record<string, number>;
}

const ScorecardImage = React.forwardRef<ScorecardImageHandle, ScorecardImageProps>(...)
```

This keeps both Scorecard and RoundSummary pages clean while ensuring the generated image is always identical regardless of which page triggers it.
