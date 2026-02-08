

## Improve Button Layout on Round Complete Page for Mobile

### Problem
Currently all three buttons ("Share", "Share Scorecard", "View Scorecard") are in a single horizontal row. On mobile screens (~375px wide), three buttons with text and icons get cramped and text may truncate.

### Solution
Split the buttons into two rows:
- **Row 1**: "Share" and "Share Scorecard" side by side (these are the two sharing actions)
- **Row 2**: "View Scorecard" full width, positioned below sharing buttons and above the Lock/Unlock Round button

### File Changed

**`src/components/RoundSummary.tsx`** (lines 430-440)

Current layout:
```
[  Share  ] [ Share Scorecard ] [ View Scorecard ]
[           Lock Round / Unlock Round             ]
```

New layout:
```
[      Share      ] [   Share Scorecard   ]
[             View Scorecard              ]
[        Lock Round / Unlock Round        ]
```

The change is straightforward -- move the "View Scorecard" button out of the `flex` row and into its own full-width button below, using `w-full` styling to match the Lock/Unlock buttons.

No other files are affected.
